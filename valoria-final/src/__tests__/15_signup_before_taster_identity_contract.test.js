"use strict";

const fs = require("fs");
const path = require("path");

const read = relative => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
const readApi = name => fs.readFileSync(path.join(__dirname, "../../api", name), "utf8");
const readMigration = name => fs.readFileSync(path.join(__dirname, "../../supabase/migrations", name), "utf8");

describe("registration-first VALU taster identity contract", () => {
  const gate = read("VALUIndexV4GateNext.jsx");
  const progressApi = readApi("taster-progress.js");
  const submitApi = readApi("submit-taster.js");
  const schema = readMigration("20261107131125_require_lead_registration_for_new_valu_tasters.sql");
  const hardened = readMigration("20261107131149_fix_taster_signup_rpc_security_and_idempotency.sql");
  const finalRpc = readMigration("20261107131213_fix_taster_identity_candidate_lead_lookup.sql");

  test("registration is the first participant-facing stage", () => {
    expect(gate).toContain("phase==='registration'");
    expect(gate).toContain("registerForTaster");
    expect(gate).toContain("action:'register'");
    expect(gate).toContain("VALUAssessmentJourney stage=\"registration\"");
    expect(gate).not.toContain("action:'init'");
    expect(progressApi).not.toContain("action === 'init'");
  });

  test("signup captures identity and useful qualification data before the taster", () => {
    for (const field of ["name:name.trim()", "email:email.trim().toLowerCase()", "role:role.trim()", "experience", "organisation:organisation.trim()", "interest"]) {
      expect(gate).toContain(field);
    }
    expect(gate).toContain("privacy_acknowledged:privacyAcknowledged");
    expect(gate).toContain("marketing_consent:marketingConsent");
    expect(gate).toContain("useState(false)");
    expect(progressApi).toContain("p_marketing_consent: body.marketing_consent === true");
    expect(progressApi).toContain("p_privacy_acknowledged: body.privacy_acknowledged === true");
  });

  test("marketing email consent remains optional and separate from assessment registration", () => {
    expect(schema).toContain("coalesce(p_marketing_consent, false)");
    expect(schema).toContain("'explicit_valu_taster_marketing_opt_in'");
    expect(schema).toContain("privacy_notice_acknowledged");
    expect(hardened).toContain("coalesce(p_marketing_consent, false)");
  });

  test("lead, progress, taster and identity-candidate records share one lead ID", () => {
    for (const table of ["taster_progress", "taster_sessions", "taster_identity_candidates"]) {
      expect(schema).toContain(`alter table public.${table}`);
      expect(schema).toContain(`${table}_lead_capture_id_fkey`);
    }
    expect(progressApi).toContain("rpc/begin_valu_taster_signup");
    expect(submitApi).toContain("p_lead_capture_id: progress.lead_capture_id");
    expect(finalRpc).toContain("c.lead_capture_id");
    expect(finalRpc).toContain("c.taster_id = v_id");
  });

  test("new progress and snapshot inserts cannot bypass the lead identity", () => {
    expect(schema).toContain("before insert on public.taster_progress");
    expect(schema).toContain("before insert on public.taster_sessions");
    expect(schema).toContain("lead_capture_id is required before a new taster record can be created");
    expect(submitApi).toContain("Complete your registration before submitting your snapshot.");
  });

  test("account creation remains a separate post-taster conversion step", () => {
    expect(gate).toContain("CONTINUE TO ACCOUNT CREATION");
    expect(gate).toContain("'/professional-signup/?'+params.toString()");
    expect(gate).toContain("async function createAccount(e)");
    expect(gate).toContain("async function registerForTaster(e)");
    expect(gate.indexOf("async function registerForTaster(e)")).toBeLessThan(gate.indexOf("async function createAccount(e)"));
  });

  test("database functions are not callable by anonymous or authenticated browser roles", () => {
    expect(hardened).toContain("revoke all on function public.begin_valu_taster_signup");
    expect(hardened).toContain("to service_role");
    expect(finalRpc).toContain("revoke all on function public.submit_taster_with_identity_candidate");
    expect(finalRpc).toContain("to service_role");
    expect(finalRpc).toContain("set search_path = ''");
  });
});
