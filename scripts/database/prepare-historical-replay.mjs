import fs from 'node:fs';
import path from 'node:path';

const workspace = process.argv[2];
if (!workspace) throw new Error('Usage: prepare-historical-replay.mjs <workspace>');

const migrationPath = path.join(workspace, 'supabase', 'migrations', '20260815000015_sprint15_security_hardening.sql');
const original = fs.readFileSync(migrationPath, 'utf8').replaceAll('\r\n', '\n');
const meetingPointPath = path.join(workspace, 'supabase', 'migrations', '20260816000021_student_booking_options.sql');
const meetingPointOriginal = fs.readFileSync(meetingPointPath, 'utf8').replaceAll('\r\n', '\n');
const ledgerPath = path.join(workspace, 'supabase', 'migrations', '20260818000032_harden_update_my_profile_and_reconcile_migrations.sql');
const ledgerOriginal = fs.readFileSync(ledgerPath, 'utf8').replaceAll('\r\n', '\n');
const ledger33Path = path.join(workspace, 'supabase', 'migrations', '20260818000033_disable_email_account_enumeration.sql');
const ledger33Original = fs.readFileSync(ledger33Path, 'utf8').replaceAll('\r\n', '\n');

const bookingReference = `alter function public.get_provider_booking_context_public(uuid)\n  set search_path = public, pg_temp;`;
const bookingGuard = `do $compat$\nbegin\n  if to_regprocedure('public.get_provider_booking_context_public(uuid)') is not null then\n    alter function public.get_provider_booking_context_public(uuid)\n      set search_path = public, pg_temp;\n  end if;\nend\n$compat$;`;

const slotReferences = `revoke all on function public.is_offering_slot_available(uuid, timestamptz) from public;\nrevoke all on function public.is_offering_slot_available(uuid, timestamptz) from anon;\nrevoke all on function public.is_offering_slot_available(uuid, timestamptz) from authenticated;`;
const slotGuard = `do $compat$\nbegin\n  if to_regprocedure('public.is_offering_slot_available(uuid, timestamptz)') is not null then\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from public;\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from anon;\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from authenticated;\n  end if;\nend\n$compat$;`;
const brokenCoordinateValidation = `    if (p_meeting_point->>'latitude' is null or p_meeting_point->>'longitude' is null\n       or (p_meeting_point->>'latitude')::double precision not between -90 and 90\n       or (p_meeting_point->>'longitude')::double precision not between -180 and 180 then`;
const fixedCoordinateValidation = `    if (p_meeting_point->>'latitude' is null or p_meeting_point->>'longitude' is null\n       or (p_meeting_point->>'latitude')::double precision not between -90 and 90\n       or (p_meeting_point->>'longitude')::double precision not between -180 and 180) then`;
const ledgerRepair = `INSERT INTO supabase_migrations.schema_migrations (version, name)\nVALUES \n  ('20260817000027', 'storage_avatars_bucket'),\n  ('20260817000028', 'fix_users_self_profile_rls'),\n  ('20260817000029', 'add_user_cpf_and_birth_date'),\n  ('20260817000030', 'check_user_email_exists'),\n  ('20260818000031', 'student_identity_mandatory_and_editable_birth_date'),\n  ('20260818000032', 'harden_update_my_profile_and_reconcile_migrations')\nON CONFLICT (version) DO NOTHING;`;
const ledgerNoop = `-- Historical ledger reconciliation is managed by the replay runner in this temporary workspace.`;
const ledger33Repair = `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)\nVALUES (\n  '20260818000033',\n  'disable_email_account_enumeration',\n  ARRAY[\n    'DROP FUNCTION IF EXISTS public.check_user_email_exists(TEXT);'\n  ]\n)\nON CONFLICT (version) DO NOTHING;`;

if (original.split(bookingReference).length !== 2) throw new Error('Expected booking forward reference not found exactly once');
if (original.split(slotReferences).length !== 2) throw new Error('Expected slot forward references not found exactly once');
if (!original.includes('revoke all on function public.create_booking_completion_notifications() from public;')) {
  throw new Error('Expected notification hardening reference was not found');
}
if (meetingPointOriginal.split(brokenCoordinateValidation).length !== 2) {
  throw new Error('Expected migration 21 coordinate validation was not found exactly once');
}
if (ledgerOriginal.split(ledgerRepair).length !== 2) {
  throw new Error('Expected migration 32 ledger reconciliation was not found exactly once');
}
if (ledger33Original.split(ledger33Repair).length !== 2) {
  throw new Error('Expected migration 33 ledger reconciliation was not found exactly once');
}

const patched = original.replace(bookingReference, bookingGuard).replace(slotReferences, slotGuard);
const meetingPointPatched = meetingPointOriginal.replace(brokenCoordinateValidation, fixedCoordinateValidation);
const ledgerPatched = ledgerOriginal.replace(ledgerRepair, ledgerNoop);
const ledger33Patched = ledger33Original.replace(ledger33Repair, ledgerNoop);
fs.writeFileSync(migrationPath, patched);
fs.writeFileSync(meetingPointPath, meetingPointPatched);
fs.writeFileSync(ledgerPath, ledgerPatched);
fs.writeFileSync(ledger33Path, ledger33Patched);
console.log(JSON.stringify({ patches: 5, repairs: [
  { migration: '20260815000015_sprint15_security_hardening.sql', type: 'forward_reference', object: 'get_provider_booking_context_public(uuid)', change: 'guard-if-exists' },
  { migration: '20260815000015_sprint15_security_hardening.sql', type: 'forward_reference', object: 'is_offering_slot_available(uuid,timestamptz)', change: 'guard-if-exists' },
  { migration: '20260816000021_student_booking_options.sql', type: 'syntax_repair', object: 'create_booking_hold_at_meeting_point(uuid,uuid,varchar,jsonb)', change: 'close missing IF parenthesis' },
  { migration: '20260818000032_harden_update_my_profile_and_reconcile_migrations.sql', type: 'replay_ledger', object: 'supabase_migrations.schema_migrations', change: 'omit redundant ledger DML managed by runner' },
  { migration: '20260818000033_disable_email_account_enumeration.sql', type: 'replay_ledger', object: 'supabase_migrations.schema_migrations', change: 'omit redundant ledger DML managed by runner' }
] }));
