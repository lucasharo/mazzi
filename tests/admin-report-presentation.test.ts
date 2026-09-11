import { describe, expect, it } from 'vitest';
import { getAdminReportLabel, translateAdminReportText } from '../src/lib/admin-report-presentation';

describe('apresentação dos relatórios administrativos', () => {
  it('traduz chaves de métricas e não deixa o nome técnico na interface', () => {
    expect(getAdminReportLabel('gateway_fee_cents')).toBe('Taxas do meio de pagamento');
    expect(getAdminReportLabel('payment_abandonment_amount_cents')).toBe('Valor de pagamentos abandonados');
    expect(getAdminReportLabel('provider_profile_views')).toBe('Perfis de profissionais vistos');
  });

  it('traduz estados, eventos e combinações vindas do banco', () => {
    expect(translateAdminReportText('PENDING_REVIEW')).toBe('Aguardando análise');
    expect(translateAdminReportText('PROVIDER_PROFILE_VIEW')).toBe('Visualização de perfil profissional');
    expect(translateAdminReportText('INSTRUCTOR / ACTIVE')).toBe('Instrutor / Ativo');
    expect(translateAdminReportText('SCHEDULE CONFLICT')).toBe('Conflito de agenda');
  });

  it('substitui termos em inglês que possam chegar em textos de apoio', () => {
    expect(translateAdminReportText('No-show')).toBe('Não comparecimento');
    expect(translateAdminReportText('Reviews')).toBe('avaliações');
    expect(translateAdminReportText('Checkout iniciado')).toBe('pagamento iniciado');
  });
});
