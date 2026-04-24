import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("dim client targets the dim schema", () => {
  const source = readFileSync("src/lib/supabase/dim.ts", "utf8");
  assert.match(source, /\.schema\("dim"\)/);
  assert.doesNotMatch(source, /createSourceCrmServerClient/);
});

run("fact client targets the fact schema", () => {
  const source = readFileSync("src/lib/supabase/fact.ts", "utf8");
  assert.match(source, /\.schema\("fact"\)/);
  assert.doesNotMatch(source, /createSourceCrmServerClient/);
});

run("web dashboard tables keep authenticated read access for global dashboard users", () => {
  const migration = readFileSync("supabase/migrations/20260424_phase32_dim_fact_access_policies.sql", "utf8");
  assert.match(migration, /current_user_can_view_global_dashboard/);
  assert.match(migration, /grant select on public\.users to authenticated, service_role/);
  assert.match(migration, /public\.nda_progress/);
  assert.match(migration, /public\.card_progress/);
});
