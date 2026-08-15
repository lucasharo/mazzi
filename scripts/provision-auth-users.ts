import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing!');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const DEMO_USERS = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    email: 'aluno.demo@mazzi.com.br',
    name: 'Ana Clara Silva (Demo)',
    phone: '11988880001',
    role: 'STUDENT',
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    email: 'carlos.instrutor@mazzi.com.br',
    name: 'Carlos Alberto de Souza (Demo)',
    phone: '11988880002',
    role: 'INSTRUCTOR',
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    email: 'admin.paulista@mazzi.com.br',
    name: 'Diretor Autoescola Paulista (Demo)',
    phone: '11988880003',
    role: 'SCHOOL_ADMIN',
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    email: 'marcos.instrutor@mazzi.com.br',
    name: 'Marcos Vinícius (Demo)',
    phone: '11988880004',
    role: 'INSTRUCTOR',
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    email: 'admin.master@mazzi.com.br',
    name: 'Administrador MAZZI (Demo)',
    phone: '11988880099',
    role: 'PLATFORM_ADMIN',
  },
];

async function provision() {
  console.log('====================================================');
  console.log('MAZZI — PROVISIONING AUTH TEST IDENTITIES');
  console.log('====================================================\n');

  for (const user of DEMO_USERS) {
    console.log(`Provisioning ${user.role}: ${user.email}...`);
    
    // First, delete if already exists to avoid conflict and keep clean
    try {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = (listData as any)?.users?.find((u: any) => u.email === user.email || u.id === user.id);
      if (existing) {
        console.log(`User already exists with ID ${existing.id}. Deleting existing auth user...`);
        await supabaseAdmin.auth.admin.deleteUser(existing.id);
      }
    } catch (e) {
      console.log('Error checking/deleting existing user:', e);
    }

    // Now, create the user with the specified ID and email
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: 'MazziPassword123!',
      email_confirm: true,
      user_metadata: {
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });

    if (error) {
      console.error(`Failed to create user ${user.email}:`, error.message);
    } else {
      console.log(`Successfully created user ${user.email} with ID ${data.user.id}`);
      
      // Ensure role exists in public.user_roles as well
      const { error: roleErr } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: user.id, role: user.role })
        .select();
      if (roleErr && roleErr.code !== '23505') { // Ignore unique constraint violation
        console.log(`Notice: Role insertion for ${user.role} got code ${roleErr.code}: ${roleErr.message}`);
      }
    }
  }

  console.log('\nAll auth test identities provisioned successfully!');
}

provision().catch(err => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
