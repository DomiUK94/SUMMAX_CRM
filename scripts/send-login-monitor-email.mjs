import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : "true";
    parsed[key] = value;
    if (value !== "true") index += 1;
  }
  return parsed;
}

function formatMadridDateTime(value) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

loadEnvFile();

const args = parseArgs(process.argv.slice(2));
const targetEmail = args.user ?? process.env.LOGIN_MONITOR_USER_EMAIL ?? "christian.galloespinel@gmail.com";
const recipientsRaw = args.to ?? process.env.LOGIN_MONITOR_TO ?? "david@todoessingular.com,domiuk94@gmail.com";
const fromEmail = process.env.RESEND_FROM_EMAIL;
const resendApiKey = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dryRun = args["dry-run"] === "true";

if (!supabaseUrl || !supabaseAnonKey) throw new Error("Missing Supabase env vars");
if (!dryRun && !fromEmail) throw new Error("Missing RESEND_FROM_EMAIL");
if (!dryRun && !resendApiKey) throw new Error("Missing RESEND_API_KEY");

const recipients = recipientsRaw.split(",").map((item) => item.trim()).filter(Boolean);
if (recipients.length === 0) throw new Error("No recipients configured");

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: users, error: usersError } = await supabase
  .from("users")
  .select("id, email, created_at, updated_at")
  .eq("email", targetEmail)
  .limit(1);

if (usersError) throw usersError;
if (!users || users.length === 0) throw new Error(`User not found: ${targetEmail}`);

const user = users[0];

const [ndaProgressRes, cardProgressRes] = await Promise.all([
  supabase.from("nda_progress").select("confirmed_at").eq("user_id", user.id).order("confirmed_at", { ascending: false }).limit(1),
  supabase.from("card_progress").select("updated_at").eq("user_id", user.id).eq("status", "viewed").order("updated_at", { ascending: false }).limit(1)
]);

if (ndaProgressRes.error) throw ndaProgressRes.error;
if (cardProgressRes.error) throw cardProgressRes.error;

const lastNdaAt = ndaProgressRes.data?.[0]?.confirmed_at ?? null;
const lastCardAt = cardProgressRes.data?.[0]?.updated_at ?? null;
const candidates = [user.updated_at, lastCardAt, lastNdaAt, user.created_at].filter(Boolean);
if (candidates.length === 0) throw new Error(`No activity found for ${targetEmail}`);

const lastSeenAt = candidates.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
const formattedLastSeenAt = formatMadridDateTime(lastSeenAt);

const subject = "Ultima hora conexion Christian G.";
const text = `La cuenta de Christian ha sido utilizada a las ${formattedLastSeenAt} por ultima vez`;

if (dryRun) {
  console.log(JSON.stringify({ ok: true, dryRun: true, targetEmail, recipients, subject, text, lastSeenAt, formattedLastSeenAt }, null, 2));
  process.exit(0);
}

const emailResponse = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${resendApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    from: fromEmail,
    to: recipients,
    subject,
    text
  })
});

if (!emailResponse.ok) {
  const details = await emailResponse.text();
  throw new Error(`Resend error ${emailResponse.status}: ${details}`);
}

const payload = await emailResponse.json();
console.log(JSON.stringify({ ok: true, targetEmail, recipients, lastSeenAt, formattedLastSeenAt, payload }, null, 2));
