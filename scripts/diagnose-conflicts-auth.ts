import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  console.log('Logging in as Quick Dev Student...');
  const studentEmail = process.env.VITE_DEV_QUICK_LOGIN_STUDENT_EMAIL || 'aluno01@mazzi.com.br';
  const rawPass = process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD;
  if (!rawPass) {
    console.error('FAIL FAST: VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD environment variable is required.');
    process.exit(1);
  }
  const studentPass = rawPass.replace(/^"|"$/g, '').trim();

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: studentEmail,
    password: studentPass,
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    return;
  }

  console.log('Logged in successfully as student ID:', authData.user.id);

  const { data: studentBookings, error: bErr } = await supabase
    .from('bookings')
    .select('id, student_id, provider_id, instructor_id, status, scheduled_start_at, scheduled_end_at, created_at, total_in_cents')
    .eq('student_id', authData.user.id)
    .order('created_at', { ascending: false });

  if (bErr) {
    console.error('Error fetching bookings:', bErr);
    return;
  }

  console.log(`Found ${studentBookings?.length || 0} bookings for student ${authData.user.id}:`);
  studentBookings?.forEach((b, idx) => {
    console.log(`[${idx + 1}] ID: ${b.id} | Status: ${b.status} | Start: ${b.scheduled_start_at} | End: ${b.scheduled_end_at} | Created: ${b.created_at}`);
  });

  // Check overlaps among active bookings
  const activeBookings = studentBookings?.filter(b => ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)) || [];
  console.log(`\nActive bookings count for student: ${activeBookings.length}`);

  const conflicts: any[] = [];
  for (let i = 0; i < activeBookings.length; i++) {
    for (let j = i + 1; j < activeBookings.length; j++) {
      const b1 = activeBookings[i];
      const b2 = activeBookings[j];
      const start1 = new Date(b1.scheduled_start_at).getTime();
      const end1 = new Date(b1.scheduled_end_at).getTime();
      const start2 = new Date(b2.scheduled_start_at).getTime();
      const end2 = new Date(b2.scheduled_end_at).getTime();

      if (start1 < end2 && start2 < end1) {
        conflicts.push({ b1, b2 });
      }
    }
  }

  console.log(`Student active overlapping conflicts found: ${conflicts.length}`);
  conflicts.forEach((c, idx) => {
    console.log(`\nConflict Pair #${idx + 1}:`);
    console.log(' Booking 1:', c.b1);
    console.log(' Booking 2:', c.b2);
  });
}

main().catch(console.error);
