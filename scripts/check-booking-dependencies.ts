import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const targetBookingId = '3af862ad-4167-4260-9ccf-89f0c14f1be7';
  console.log(`Checking dependencies for booking ${targetBookingId}...`);

  // Query payments
  const { data: payments } = await supabase.from('payments').select('*').eq('booking_id', targetBookingId);
  console.log('Payments referencing booking:', payments);

  // Query conversations
  const { data: convs } = await supabase.from('conversations').select('*').eq('booking_id', targetBookingId);
  console.log('Conversations referencing booking:', convs);

  // Query reviews
  const { data: reviews } = await supabase.from('reviews').select('*').eq('booking_id', targetBookingId);
  console.log('Reviews referencing booking:', reviews);

  // Query financial_events
  const { data: finEvents } = await supabase.from('financial_events').select('*').eq('booking_id', targetBookingId);
  console.log('Financial events referencing booking:', finEvents);
}

main().catch(console.error);
