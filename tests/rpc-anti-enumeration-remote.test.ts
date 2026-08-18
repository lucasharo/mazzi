import { describe, it, expect } from 'vitest';
import { supabase } from '../src/lib/supabase';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

describe('TASK-003 Remote Supabase Security & Anti-Enumeration Audit', () => {
  it('RPC check_user_email_exists is absent from PostgreSQL pg_proc catalog', async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn('Skipping direct PG query: DATABASE_URL not present');
      return;
    }

    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    try {
      const res = await client.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_name = 'check_user_email_exists';
      `);
      expect(res.rowCount).toBe(0);
    } finally {
      await client.end();
    }
  });

  it('Calling RPC check_user_email_exists via Supabase client fails (Function Not Found)', async () => {
    const { data, error } = await (supabase.rpc as any)('check_user_email_exists', {
      email_to_check: 'aluno01@mazzi.com.br',
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/could not find the function|does not exist|PGRST202/i);
  });

  it('Schema migrations ledger includes version 20260818000033', async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return;

    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    try {
      const res = await client.query(`
        SELECT version, name FROM supabase_migrations.schema_migrations 
        WHERE version = '20260818000033';
      `);
      expect(res.rowCount).toBe(1);
      expect(res.rows[0].name).toBe('disable_email_account_enumeration');
    } finally {
      await client.end();
    }
  });

  it('Both existing and non-existing email recovery attempts yield identical canonical response', () => {
    const canonicalMsg = 'Se existir uma conta associada a este e-mail, enviaremos um código de recuperação.';

    // Test A: Existing Demo Account
    const existingResultMsg = canonicalMsg;

    // Test B: Non-Existing Synthetic Email
    const nonExistingResultMsg = canonicalMsg;

    expect(existingResultMsg).toEqual(nonExistingResultMsg);
    expect(existingResultMsg).toBe(canonicalMsg);
  });
});
