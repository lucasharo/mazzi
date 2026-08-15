// ============================================================================
// MAZZI PLATFORM — ADMINISTRATIVE QUERY SCRIPT (BYPASS RLS VIA SERVICE ROLE)
// File: scripts/query-bookings.ts
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estão configuradas no arquivo .env!');
  console.log('Certifique-se de que o arquivo .env contém as seguintes definições:');
  console.log('SUPABASE_URL=sua-url-do-supabase');
  console.log('SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-privada');
  process.exit(1);
}

// Inicializa o cliente do Supabase utilizando a Service Role Key (Bypass RLS)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function queryBookings() {
  console.log('================================================================');
  console.log('🔎 CONSULTA ADMINISTRATIVA DE RESERVAS (BYPASS RLS via SERVICE ROLE)');
  console.log('================================================================\n');

  console.log('Iniciando busca direta de dados na tabela "bookings"...');

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      id,
      status,
      scheduled_start_at,
      scheduled_end_at,
      price_in_cents,
      student_id,
      provider_id,
      vehicle_id,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Falha ao realizar a consulta no Supabase:');
    console.error(`- Código de Erro: ${error.code}`);
    console.error(`- Mensagem: ${error.message}`);
    console.error(`- Detalhes: ${error.details || 'Nenhum'}`);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('⚠️ Nenhuma reserva encontrada na tabela "bookings" do banco de dados.');
    process.exit(0);
  }

  console.log(`✅ Sucesso! Foram encontradas ${data.length} reservas registradas:\n`);

  data.forEach((booking, idx) => {
    const valorFormatado = (booking.price_in_cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    console.log(`[Reserva #${idx + 1}]`);
    console.log(`  • ID:             ${booking.id}`);
    console.log(`  • Status:         ${booking.status}`);
    console.log(`  • Horário Início: ${booking.scheduled_start_at}`);
    console.log(`  • Horário Fim:    ${booking.scheduled_end_at}`);
    console.log(`  • Valor Unitário: ${valorFormatado}`);
    console.log(`  • ID do Aluno:    ${booking.student_id}`);
    console.log(`  • ID do Provedor: ${booking.provider_id}`);
    console.log(`  • ID do Veículo:  ${booking.vehicle_id}`);
    console.log(`  • Criado em:      ${booking.created_at}`);
    console.log('----------------------------------------------------------------');
  });

  console.log('\n================================================================');
  console.log('✅ Execução concluída com sucesso com credenciais administrativas.');
  console.log('================================================================');
}

queryBookings().catch((err) => {
  console.error('❌ Erro inesperado ao executar o script de consulta:', err);
  process.exit(1);
});
