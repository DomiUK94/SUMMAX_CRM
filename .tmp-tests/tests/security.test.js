"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const navigation_1 = require("../src/lib/security/navigation");
const rate_limit_1 = require("../src/lib/security/rate-limit");
function run(name, fn) {
    try {
        fn();
        console.log(`PASS ${name}`);
    }
    catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}
run("sanitizeRedirectPath keeps only same-origin relative paths", () => {
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("/dashboard/me"), "/dashboard/me");
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("/contacts?tab=mine"), "/contacts?tab=mine");
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("https://evil.example.com"), "/dashboard/me");
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("//evil.example.com"), "/dashboard/me");
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("javascript:alert(1)"), "/dashboard/me");
});
run("consumeRateLimit blocks after the configured threshold", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const first = (0, rate_limit_1.consumeRateLimit)({ key, limit: 2, windowMs: 60_000 });
    const second = (0, rate_limit_1.consumeRateLimit)({ key, limit: 2, windowMs: 60_000 });
    const third = (0, rate_limit_1.consumeRateLimit)({ key, limit: 2, windowMs: 60_000 });
    strict_1.default.equal(first.allowed, true);
    strict_1.default.equal(second.allowed, true);
    strict_1.default.equal(third.allowed, false);
});
run("RLS hardening keeps operational CRM tables visible to active users", () => {
    const migration = (0, node_fs_1.readFileSync)("supabase/migrations/20260504_expose_dim_fact_postgrest.sql", "utf8");
    const operationalTables = [
        "sourcecrm.inversion",
        "sourcecrm.contactos",
        "sourcecrm.sector",
        "sourcecrm.tipo_fondo",
        "sourcecrm.mapa_area_geografica",
        "sourcecrm.entity_notes",
        "sourcecrm.entity_files",
        "sourcecrm.leads",
        "sourcecrm.opportunities",
        "sourcecrm.prospects",
        "sourcecrm.prospect_tasks"
    ];
    for (const table of operationalTables) {
        strict_1.default.match(migration, new RegExp(`grant select.*${table.replace(".", "\\.")}`, "i"));
        strict_1.default.match(migration, new RegExp(`active users read ${table.split(".")[1].replaceAll("_", " ")}`, "i"));
    }
});
console.log("All security tests passed");
