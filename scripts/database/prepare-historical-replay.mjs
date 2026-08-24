import fs from 'node:fs';
import path from 'node:path';

const workspace = process.argv[2];
if (!workspace) throw new Error('Usage: prepare-historical-replay.mjs <workspace>');

const migrationPath = path.join(workspace, 'supabase', 'migrations', '20260815000015_sprint15_security_hardening.sql');
const original = fs.readFileSync(migrationPath, 'utf8').replaceAll('\r\n', '\n');
const meetingPointPath = path.join(workspace, 'supabase', 'migrations', '20260816000021_student_booking_options.sql');
const meetingPointOriginal = fs.readFileSync(meetingPointPath, 'utf8').replaceAll('\r\n', '\n');

const bookingReference = `alter function public.get_provider_booking_context_public(uuid)\n  set search_path = public, pg_temp;`;
const bookingGuard = `do $compat$\nbegin\n  if to_regprocedure('public.get_provider_booking_context_public(uuid)') is not null then\n    alter function public.get_provider_booking_context_public(uuid)\n      set search_path = public, pg_temp;\n  end if;\nend\n$compat$;`;

const slotReferences = `revoke all on function public.is_offering_slot_available(uuid, timestamptz) from public;\nrevoke all on function public.is_offering_slot_available(uuid, timestamptz) from anon;\nrevoke all on function public.is_offering_slot_available(uuid, timestamptz) from authenticated;`;
const slotGuard = `do $compat$\nbegin\n  if to_regprocedure('public.is_offering_slot_available(uuid, timestamptz)') is not null then\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from public;\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from anon;\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from authenticated;\n  end if;\nend\n$compat$;`;
const brokenCoordinateValidation = `    if (p_meeting_point->>'latitude' is null or p_meeting_point->>'longitude' is null\n       or (p_meeting_point->>'latitude')::double precision not between -90 and 90\n       or (p_meeting_point->>'longitude')::double precision not between -180 and 180 then`;
const fixedCoordinateValidation = `    if (p_meeting_point->>'latitude' is null or p_meeting_point->>'longitude' is null\n       or (p_meeting_point->>'latitude')::double precision not between -90 and 90\n       or (p_meeting_point->>'longitude')::double precision not between -180 and 180) then`;

if (original.split(bookingReference).length !== 2) throw new Error('Expected booking forward reference not found exactly once');
if (original.split(slotReferences).length !== 2) throw new Error('Expected slot forward references not found exactly once');
if (!original.includes('revoke all on function public.create_booking_completion_notifications() from public;')) {
  throw new Error('Expected notification hardening reference was not found');
}
if (meetingPointOriginal.split(brokenCoordinateValidation).length !== 2) {
  throw new Error('Expected migration 21 coordinate validation was not found exactly once');
}

const patched = original.replace(bookingReference, bookingGuard).replace(slotReferences, slotGuard);
const meetingPointPatched = meetingPointOriginal.replace(brokenCoordinateValidation, fixedCoordinateValidation);
fs.writeFileSync(migrationPath, patched);
fs.writeFileSync(meetingPointPath, meetingPointPatched);
console.log(JSON.stringify({ patches: 3, repairs: [
  { migration: '20260815000015_sprint15_security_hardening.sql', type: 'forward_reference', object: 'get_provider_booking_context_public(uuid)', change: 'guard-if-exists' },
  { migration: '20260815000015_sprint15_security_hardening.sql', type: 'forward_reference', object: 'is_offering_slot_available(uuid,timestamptz)', change: 'guard-if-exists' },
  { migration: '20260816000021_student_booking_options.sql', type: 'syntax_repair', object: 'create_booking_hold_at_meeting_point(uuid,uuid,varchar,jsonb)', change: 'close missing IF parenthesis' }
] }));
