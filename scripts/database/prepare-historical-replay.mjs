import fs from 'node:fs';
import path from 'node:path';

const workspace = process.argv[2];
if (!workspace) throw new Error('Usage: prepare-historical-replay.mjs <workspace>');

const migrationPath = path.join(workspace, 'supabase', 'migrations', '20260815000015_sprint15_security_hardening.sql');
const original = fs.readFileSync(migrationPath, 'utf8').replaceAll('\r\n', '\n');

const bookingReference = `alter function public.get_provider_booking_context_public(uuid)\n  set search_path = public, pg_temp;`;
const bookingGuard = `do $$\nbegin\n  if to_regprocedure('public.get_provider_booking_context_public(uuid)') is not null then\n    alter function public.get_provider_booking_context_public(uuid)\n      set search_path = public, pg_temp;\n  end if;\nend\n$$;`;

const slotReferences = `revoke all on function public.is_offering_slot_available(uuid, timestamptz) from public;\nrevoke all on function public.is_offering_slot_available(uuid, timestamptz) from anon;\nrevoke all on function public.is_offering_slot_available(uuid, timestamptz) from authenticated;`;
const slotGuard = `do $$\nbegin\n  if to_regprocedure('public.is_offering_slot_available(uuid, timestamptz)') is not null then\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from public;\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from anon;\n    revoke all on function public.is_offering_slot_available(uuid, timestamptz) from authenticated;\n  end if;\nend\n$$;`;

if (original.split(bookingReference).length !== 2) throw new Error('Expected booking forward reference not found exactly once');
if (original.split(slotReferences).length !== 2) throw new Error('Expected slot forward references not found exactly once');
if (!original.includes('revoke all on function public.create_booking_completion_notifications() from public;')) {
  throw new Error('Expected notification hardening reference was not found');
}

const patched = original.replace(bookingReference, bookingGuard).replace(slotReferences, slotGuard);
fs.writeFileSync(migrationPath, patched);
console.log(JSON.stringify({ migration: migrationPath, patches: 2, booking_guard: true, slot_guard: true }));
