import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('=== DIAGNOSING SUPABASE LIVE STATE FOR TASK-009 ===\n');

  // 1. Migration Ledger Check
  const { data: migrations, error: migErr } = await supabase
    .schema('supabase_migrations')
    .from('schema_migrations')
    .select('version')
    .order('version', { ascending: false });

  if (migErr) {
    console.error('Failed to query schema_migrations:', migErr);
  } else {
    console.log('Latest applied migrations:');
    console.log(migrations?.slice(0, 10));
  }

  // 2. Active Student Conflicts Check
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('id, student_id, provider_id, instructor_id, status, scheduled_start_at, scheduled_end_at, created_at')
    .in('status', ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS']);

  if (bErr) {
    console.error('Failed to query bookings:', bErr);
  } else {
    console.log(`\nActive bookings count: ${bookings?.length || 0}`);
    
    // Check for student overlapping conflicts
    const conflicts: { student_id: string; b1: any; b2: any }[] = [];
    for (let i = 0; i < (bookings?.length || 0); i++) {
      for (let j = i + 1; j < (bookings?.length || 0); j++) {
        const b1 = bookings![i];
        const b2 = bookings![j];
        if (b1.student_id === b2.student_id) {
          const start1 = new Date(b1.scheduled_start_at).getTime();
          const end1 = new Date(b1.scheduled_end_at).getTime();
          const start2 = new Date(b2.scheduled_start_at).getTime();
          const end2 = new Date(b2.scheduled_end_at).getTime();

          // Half-open interval overlap check: [start1, end1) && [start2, end2)
          if (start1 < end2 && start2 < end1) {
            conflicts.push({ student_id: b1.student_id, b1, b2 });
          }
        }
      }
    }

    console.log(`Student overlapping conflicts found: ${conflicts.length}`);
    conflicts.forEach((c, idx) => {
      console.log(`\nConflict #${idx + 1} for student ${c.student_id}:`);
      console.log(' Booking 1:', {
        id: c.b1.id,
        status: c.b1.status,
        provider_id: c.b1.provider_id,
        start: c.b1.scheduled_start_at,
        end: c.b1.scheduled_end_at,
        created: c.b1.created_at,
      });
      console.log(' Booking 2:', {
        id: c.b2.id,
        status: c.b2.status,
        provider_id: c.b2.provider_id,
        start: c.b2.scheduled_start_at,
        end: c.b2.scheduled_end_at,
        created: c.b2.created_at,
      });
    });
  }

  // 3. Inspect RPCs and payments table
  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('*')
    .limit(5);

  if (pErr) {
    console.error('Failed to query payments:', pErr);
  } else {
    console.log(`\nPayments table count sample: ${payments?.length || 0}`);
  }
}

main().catch(console.error);
