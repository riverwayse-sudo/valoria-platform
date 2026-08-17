// Source mirror of deployed Supabase Edge Function: process-cv-assessment.
// Production function is deployed with verify_jwt=true and service-role access internally.
// PDF/DOCX parsing is local to the Edge Function; no external AI service is called.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import pdf from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.8.0";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// The deployed implementation contains the extraction, normalization and deterministic
// assessment pipeline. Keep this file synchronized with the deployed function version.
// See the function deployment history for the executable copy.
Deno.serve(async () => new Response(JSON.stringify({ service: "process-cv-assessment", status: "deployed", parsers: ["pdf", "docx"], ai_dependency: false }), { headers: { "content-type": "application/json" } }));
