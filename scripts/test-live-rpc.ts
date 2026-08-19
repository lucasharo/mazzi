import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('Testing create_booking_payment RPC with service_role...');
  const fakeUuid = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await supabase.rpc('create_booking_payment', {
    p_booking_id: fakeUuid,
    p_method: 'PIX',
    p_idempotency_key: 'idem_test_inspection',
    p_gateway_provider: 'fake_payment_gateway',
  });

  console.log('RPC Response with service_role:', { data, error });
}

main().catch(console.error);
