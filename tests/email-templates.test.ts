import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REQUIRED_EMAIL_TEMPLATES, syncEmailTemplates } from '../scripts/sync-email-templates.mjs';
import { EMAIL_TEMPLATE_CONTRACTS, type ProPayoutCompletedParams, type StudentPaymentConfirmedParams } from '../supabase/functions/_shared/email/email-types';
import { createEmailProvider } from '../supabase/functions/_shared/email/email-provider';
import { renderTemplate } from '../supabase/functions/_shared/email/render-template';

const sourceDir = resolve('emails');
const runtimeDir = resolve('supabase/functions/_shared/email/templates');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'mazzi-email-templates-'));
  temporaryDirectories.push(directory);
  return directory;
}

function readTemplate(name: string): string {
  return readFileSync(join(runtimeDir, name), 'utf8');
}

const studentPaymentParams: StudentPaymentConfirmedParams = {
  mazzi_logo_src: 'https://assets.example.com/mazzi-logo.png',
  student_name: 'Aluno Exemplo',
  total_paid: 'R$ 100,00',
  lesson_amount: 'R$ 90,00',
  payment_reference: 'PAY-123',
  provider_name: 'Instrutor Exemplo',
  lesson_date: '08/09/2026',
  lesson_start_time: '15:00',
  lesson_end_time: '15:50',
  license_category: 'B',
  vehicle_brand: 'Hyundai',
  vehicle_model: 'HB20',
  vehicle_year: '2024',
  vehicle_transmission: 'Manual',
  vehicle_color: 'Prata',
  lesson_url: 'https://app.example.com/aulas/booking-123',
};

const payoutParams: ProPayoutCompletedParams = {
  mazzi_logo_src: 'https://assets.example.com/mazzi-logo.png',
  provider_first_name: 'Instrutor',
  payout_amount: 'R$ 80,00',
  payout_date: '08/09/2026',
  payout_method: 'Conta bancária',
  bank_name: 'Banco Exemplo',
  bank_branch_last2: '42',
  bank_account_last4: '4821',
  gross_amount: 'R$ 100,00',
  mazzi_fee_amount: 'R$ 20,00',
  payout_reference: 'PAY-123',
  earnings_url: 'https://app.example.com/pro/ganhos',
};

describe('MAZZI transactional email templates', () => {
  it('has the five required templates and keeps runtime bytes identical to the approved source', () => {
    for (const filename of REQUIRED_EMAIL_TEMPLATES) {
      expect(existsSync(join(sourceDir, filename))).toBe(true);
      expect(existsSync(join(runtimeDir, filename))).toBe(true);
      expect(readTemplate(filename)).toBe(readFileSync(join(sourceDir, filename), 'utf8'));
    }
  });

  it('copies all files deterministically without modifying the source templates', async () => {
    const temporarySource = temporaryDirectory();
    const temporaryDestination = join(temporaryDirectory(), 'runtime');
    const sourceHashes = new Map<string, string>();
    for (const filename of REQUIRED_EMAIL_TEMPLATES) {
      const content = `<!doctype html><p>${filename}</p>`;
      writeFileSync(join(temporarySource, filename), content, 'utf8');
      sourceHashes.set(filename, createHash('sha256').update(content).digest('hex'));
    }

    const result = await syncEmailTemplates({ sourceDir: temporarySource, destinationDir: temporaryDestination });
    expect(result.files).toEqual([...REQUIRED_EMAIL_TEMPLATES]);
    for (const filename of REQUIRED_EMAIL_TEMPLATES) {
      const copied = readFileSync(join(temporaryDestination, filename), 'utf8');
      expect(createHash('sha256').update(copied).digest('hex')).toBe(sourceHashes.get(filename));
      expect(readFileSync(join(temporarySource, filename), 'utf8')).toBe(`<!doctype html><p>${filename}</p>`);
    }
  });

  it('fails when a required source template is absent', async () => {
    const temporarySource = temporaryDirectory();
    for (const filename of REQUIRED_EMAIL_TEMPLATES.slice(1)) writeFileSync(join(temporarySource, filename), filename, 'utf8');
    await expect(syncEmailTemplates({ sourceDir: temporarySource, destinationDir: join(temporaryDirectory(), 'runtime') }))
      .rejects.toThrow('student-payment-confirmed.html');
  });

  it('renders every approved contract with all placeholders resolved', () => {
    const rendered = renderTemplate('student-payment-confirmed', readTemplate('student-payment-confirmed.html'), studentPaymentParams);
    expect(rendered).toContain('Olá, Aluno Exemplo!');
    expect(rendered).toContain('https://app.example.com/aulas/booking-123');
    expect(rendered).toContain('Novo layout · v2');
    expect(rendered).toContain('data-mazzi-template="student-payment-confirmed-inline-v2"');
    expect(rendered).not.toMatch(/\{\{[^}]+\}\}/);
    expect(Object.keys(EMAIL_TEMPLATE_CONTRACTS)).toHaveLength(5);
  });

  it('fails for missing or residual placeholders', () => {
    const source = readTemplate('student-payment-confirmed.html');
    const { provider_name: _providerName, ...missingProvider } = studentPaymentParams;
    expect(() => renderTemplate('student-payment-confirmed', source, missingProvider as StudentPaymentConfirmedParams))
      .toThrow('EMAIL_REQUIRED_PARAMETER_MISSING:provider_name');
    expect(() => renderTemplate('student-payment-confirmed', source, { ...studentPaymentParams, student_name: '{{still_here}}' }))
      .toThrow('EMAIL_RESIDUAL_PLACEHOLDER');
  });

  it('escapes text values and never evaluates template content', () => {
    const rendered = renderTemplate('student-payment-confirmed', readTemplate('student-payment-confirmed.html'), {
      ...studentPaymentParams,
      student_name: '<img src=x onerror=alert(1)>',
    });
    expect(rendered).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(rendered).not.toContain('<img src=x onerror=alert(1)>');
    expect(readFileSync('supabase/functions/_shared/email/render-template.ts', 'utf8')).not.toMatch(/\beval\s*\(/);
  });

  it('accepts HTTPS URLs and rejects unsafe URL schemes', () => {
    expect(() => renderTemplate('student-payment-confirmed', readTemplate('student-payment-confirmed.html'), studentPaymentParams)).not.toThrow();
    expect(() => renderTemplate('student-payment-confirmed', readTemplate('student-payment-confirmed.html'), {
      ...studentPaymentParams,
      lesson_url: 'javascript:alert(1)',
    })).toThrow('EMAIL_INVALID_URL:lesson_url');
  });

  it('requires only masked payout bank fragments and has no complete-account placeholder', () => {
    const source = readTemplate('pro-payout-completed.html');
    expect(source).not.toMatch(/bank_(?:branch|account)(?!_last(?:2|4))/);
    expect(() => renderTemplate('pro-payout-completed', source, payoutParams)).not.toThrow();
    expect(() => renderTemplate('pro-payout-completed', source, {
      ...payoutParams,
      bank_name: 'Conta cadastrada no MAZZI',
      bank_branch_last2: 'não informado',
      bank_account_last4: 'não informado',
    })).not.toThrow();
    expect(() => renderTemplate('pro-payout-completed', source, { ...payoutParams, bank_account_last4: '123456' }))
      .toThrow('EMAIL_BANK_ACCOUNT_LAST4_REQUIRED');
    expect(() => renderTemplate('pro-payout-completed', source, { ...payoutParams, bank_branch_last2: '123' }))
      .toThrow('EMAIL_BANK_BRANCH_LAST2_REQUIRED');
  });

  it('provides a no-op email provider without making a network call', async () => {
    await expect(createEmailProvider().send({ to: 'student@example.com', subject: 'Teste', html: '<p>Teste</p>' }))
      .resolves.toEqual({ accepted: false, provider: 'noop', reason: 'EMAIL_PROVIDER_NOT_IMPLEMENTED' });
  });
});
