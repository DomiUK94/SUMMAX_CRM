import { createClient } from "@supabase/supabase-js";

function readFlag(name) {
  return process.argv.includes(`--${name}`);
}

function readArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : "";
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function countAll(table) {
  const result = await table.select("*", { count: "exact", head: true });
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function deleteAll(table, idColumn = "id") {
  const result = await table.delete({ count: "exact" }).not(idColumn, "is", null);
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function main() {
  const mode = readArg("mode") || "activity";
  const yes = readFlag("yes");
  const dryRun = !yes || readFlag("dry-run");

  if (!["activity", "all-pipeline"].includes(mode)) {
    throw new Error('Invalid --mode. Use "activity" or "all-pipeline".');
  }

  const supabase = createAdminClient();
  const sourcecrm = supabase.schema("sourcecrm");
  const fact = supabase.schema("fact");

  const plan = [
    { label: "prospect_tasks", table: sourcecrm.from("prospect_tasks"), idColumn: "id" },
    { label: "pipeline_event", table: fact.from("pipeline_event"), idColumn: "id" }
  ];

  if (mode === "all-pipeline") {
    plan.push(
      { label: "opportunities", table: sourcecrm.from("opportunities"), idColumn: "id" },
      { label: "leads", table: sourcecrm.from("leads"), idColumn: "id" },
      { label: "prospects", table: sourcecrm.from("prospects"), idColumn: "id" }
    );
  }

  console.log(`Mode: ${mode}`);
  console.log(`Execution: ${dryRun ? "DRY RUN" : "DELETE"}`);
  console.log("This script never touches sourcecrm.contactos or sourcecrm.inversion.");
  console.log("");

  const counts = [];
  for (const step of plan) {
    const count = await countAll(step.table);
    counts.push({ ...step, count });
    console.log(`${step.label}: ${count}`);
  }

  if (dryRun) {
    console.log("");
    console.log("Dry run only. Re-run with --yes to execute.");
    console.log("Examples:");
    console.log("  node scripts/delete-task-data.mjs --mode=activity --yes");
    console.log("  node scripts/delete-task-data.mjs --mode=all-pipeline --yes");
    return;
  }

  console.log("");
  console.log("Deleting data...");

  for (const step of counts) {
    const deleted = await deleteAll(step.table, step.idColumn);
    console.log(`Deleted ${deleted} rows from ${step.label}`);
  }

  console.log("");
  console.log("Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
