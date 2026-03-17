import { createClient } from "@supabase/supabase-js";

function readArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : "";
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = readArg("email").toLowerCase();
  const userIdArg = readArg("user-id");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!email && !userIdArg) {
    throw new Error("Provide --email=<user@company.com> or --user-id=<uuid>");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let authUser = null;
  if (userIdArg) {
    const result = await supabase.auth.admin.getUserById(userIdArg);
    authUser = result.data.user;
  } else {
    let page = 1;
    while (!authUser) {
      const result = await supabase.auth.admin.listUsers({
        page,
        perPage: 200
      });
      if (result.error) throw result.error;
      authUser = result.data.users.find((user) => (user.email ?? "").toLowerCase() === email) ?? null;
      if (!authUser || result.data.users.length < 200) {
        if (authUser) break;
        if (result.data.users.length < 200) break;
      }
      page += 1;
    }
  }

  if (!authUser?.id || !authUser.email) {
    throw new Error("Auth user not found");
  }

  const crm = supabase.schema("sourcecrm");
  const upsert = await crm.from("users").upsert(
    {
      id: authUser.id,
      email: authUser.email,
      full_name: typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : null,
      role: "admin",
      can_view_global_dashboard: true,
      is_active: true,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (upsert.error) throw upsert.error;

  console.log(`CRM admin provisioned for ${authUser.email} (${authUser.id})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
