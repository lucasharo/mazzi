import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const confirmationTemplate = readFileSync('supabase/templates/auth-confirmation.html', 'utf8');
const recoveryTemplate = readFileSync('supabase/templates/auth-recovery.html', 'utf8');

describe('MAZZI Supabase Auth email templates', () => {
  it('uses the official OTP token in the confirmation template', () => {
    expect(confirmationTemplate).toContain('<title>Confirme seu e-mail - MAZZI</title>');
    expect(confirmationTemplate).toContain('{{ .Token }}');
    expect(confirmationTemplate).toContain('Ativação da conta');
    expect(confirmationTemplate).toContain('align="center" style="padding:24px 32px;background:#0d0f12;"');
    expect(confirmationTemplate).not.toContain('height:4px;line-height:4px;background:#f6c945');
    expect(confirmationTemplate).toContain('border:1px solid #cfd4da;border-radius:16px;background:#f7f7f7');
    expect(confirmationTemplate).not.toContain('background:#fff9df');
    expect(confirmationTemplate).not.toContain('border:1px solid #f2d16b');
    expect(confirmationTemplate).not.toContain('{{ .ConfirmationURL }}');
  });

  it('uses the official OTP token in the recovery template', () => {
    expect(recoveryTemplate).toContain('<title>Altere sua senha - MAZZI</title>');
    expect(recoveryTemplate).toContain('{{ .Token }}');
    expect(recoveryTemplate).toContain('Segurança da conta');
    expect(recoveryTemplate).toContain('align="center" style="padding:24px 32px;background:#0d0f12;"');
    expect(recoveryTemplate).not.toContain('height:4px;line-height:4px;background:#f6c945');
    expect(recoveryTemplate).toContain('border:1px solid #cfd4da;border-radius:16px;background:#f7f7f7');
    expect(recoveryTemplate).not.toContain('background:#fff9df');
    expect(recoveryTemplate).not.toContain('border:1px solid #f2d16b');
    expect(recoveryTemplate).not.toContain('{{ .ConfirmationURL }}');
  });
});
