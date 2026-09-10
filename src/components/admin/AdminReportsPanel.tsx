import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Check, FileDown, RefreshCw } from 'lucide-react';
import { dbService } from '../../lib/db-service';
import { formatCentsToBRL } from '../../domain/money';
import { formatDateBR, getBusinessDateOnly } from '../../lib/date-format';
import { AdminReportKey, AdminReportsResponse } from '../../types';
import { Button, ButtonBase } from '../ui/Button';
import { Input } from '../ui/Input';

const REPORTS: Array<{ key: AdminReportKey; title: string; description: string }> = [
  { key: 'executive', title: 'Resumo executivo', description: 'Visão consolidada de usuários, oferta, reservas, funil, financeiro e qualidade.' },
  { key: 'bookings', title: 'Operação de reservas', description: 'Volume e distribuição das reservas por status, incluindo Aula Agora.' },
  { key: 'revenue', title: 'Receita e pagamentos', description: 'Volume transacionado, taxas, pagamentos pagos e falhas.' },
  { key: 'payouts', title: 'Repasses aos profissionais', description: 'Valores criados, pendentes, pagos e falhos.' },
  { key: 'supply', title: 'Oferta de profissionais', description: 'Prestadores, veículos e ofertas ativas e criadas no período.' },
  { key: 'demand', title: 'Demanda e liquidez', description: 'Busca, visualização de agenda, checkout e buscas sem resultado.' },
  { key: 'users', title: 'Usuários e ativação', description: 'Novos usuários, distribuição por papel e status.' },
  { key: 'compliance', title: 'Compliance', description: 'Documentos enviados, aprovados, pendentes, rejeitados e próximos do vencimento.' },
  { key: 'cancellations', title: 'Cancelamentos e contestações', description: 'Cancelamentos, disputas, resoluções e valores de reembolso.' },
  { key: 'communications', title: 'Notificações e e-mails', description: 'Notificações geradas e entregas de e-mail por status.' },
];

const LABELS: Record<string, string> = {
  active_students: 'Alunos ativos',
  active_instructor_users: 'Instrutores ativos',
  active_school_admin_users: 'Admins de autoescola ativos',
  active_users_total: 'Usuários ativos',
  active_providers: 'Prestadores ativos',
  active_individual_providers: 'Instrutores individuais ativos',
  active_driving_schools: 'Autoescolas ativas',
  active_vehicles: 'Veículos ativos',
  active_offerings: 'Ofertas ativas',
  quote_to_booking_rate: 'Conversão cotação → reserva',
  booking_to_paid_rate: 'Conversão reserva → pagamento',
  paid_volume_cents: 'Volume pago',
  platform_fee_volume_cents: 'Taxa MAZZI',
  refund_volume_cents: 'Reembolsos',
  payout_pending_cents: 'Repasses pendentes',
  payout_paid_cents: 'Repasses pagos',
  gross_volume_cents: 'Volume bruto',
  gateway_fee_cents: 'Taxas do gateway',
  platform_fee_cents: 'Taxas da plataforma',
  amount_cents: 'Valor',
  refunds_cents: 'Reembolsos',
  count: 'Quantidade',
  total: 'Total',
};

function labelFor(key: string): string {
  return LABELS[key] || key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isMoneyKey(key: string): boolean {
  return key.endsWith('_cents') || key === 'amount_cents';
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (isMoneyKey(key)) return formatCentsToBRL(Number(value));
  if (key.endsWith('_rate')) return `${(Number(value) * 100).toFixed(1)}%`;
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  return String(value);
}

function flattenObject(value: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  return Object.entries(value).flatMap(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return flattenObject(child as Record<string, unknown>, fullKey);
    }
    return [[fullKey, child]] as Array<[string, unknown]>;
  });
}

function isReportSection(value: unknown): value is { summary: Record<string, unknown>; rows: Array<Record<string, unknown>> } {
  return Boolean(value && typeof value === 'object' && 'summary' in value && 'rows' in value);
}

function getLocalDateRange(): { from: string; to: string } {
  return { from: getBusinessDateOnly(-29), to: getBusinessDateOnly(0) };
}

function getPeriodDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export const AdminReportsPanel: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const initialRange = useMemo(getLocalDateRange, []);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [selected, setSelected] = useState<Record<AdminReportKey, boolean>>(
    () => Object.fromEntries(REPORTS.map(({ key }) => [key, true])) as Record<AdminReportKey, boolean>,
  );
  const [data, setData] = useState<AdminReportsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setError('Informe as datas inicial e final.');
      return;
    }
    if (dateFrom > dateTo) {
      setError('A data inicial não pode ser posterior à data final.');
      return;
    }
    if (getPeriodDays(dateFrom, dateTo) > 366) {
      setError('O período máximo dos relatórios é de 366 dias.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setData(await dbService.getAdminReports(dateFrom, getBusinessDateOnly(1, new Date(`${dateTo}T12:00:00`))));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os relatórios.');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const handlePrint = () => {
    const previousTitle = document.title;
    document.title = `MAZZI — Relatórios — ${dateFrom} a ${dateTo}`;
    window.print();
    window.setTimeout(() => { document.title = previousTitle; }, 1000);
  };

  const visibleReportCount = REPORTS.filter(({ key }) => selected[key]).length;

  const applyPreset = (days: 7 | 30 | 90 | 366) => {
    setDateFrom(getBusinessDateOnly(-(days - 1)));
    setDateTo(getBusinessDateOnly(0));
  };

  return (
    <section className="admin-reports-print-shell space-y-5 text-left" data-admin-reports-print>
      <div className="admin-reports-controls rounded-3xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <h2 className="text-xl font-black text-slate-900">Relatórios operacionais</h2>
            </div>
            <p className="mt-1 max-w-3xl text-xs font-semibold text-slate-500">
              Dados calculados no backend. Selecione o período e os relatórios que deseja visualizar ou salvar em PDF.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" leftIcon={<FileDown className="h-4 w-4" aria-hidden="true" />} onClick={handlePrint} disabled={!data || isLoading || visibleReportCount === 0}>
              Baixar PDF
            </Button>
            <Button type="button" variant="primary" size="sm" leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={() => void load()} isLoading={isLoading}>
              Atualizar relatórios
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_1fr]">
          <label className="text-xs font-bold text-slate-700">
            Data inicial
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1" leftIcon={<CalendarDays className="h-4 w-4" aria-hidden="true" />} />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Data final
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1" leftIcon={<CalendarDays className="h-4 w-4" aria-hidden="true" />} />
          </label>
          <div className="flex items-end text-xs font-semibold text-slate-500">
            Período selecionado: {dateFrom && dateTo ? `${formatDateBR(dateFrom)} a ${formatDateBR(dateTo)} (${getPeriodDays(dateFrom, dateTo)} dias)` : '—'}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Atalhos</span>
          {[7, 30, 90, 366].map((days) => (
            <ButtonBase
              key={days}
              type="button"
              onClick={() => applyPreset(days as 7 | 30 | 90 | 366)}
              disabled={isLoading}
              className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50"
            >
              {days === 366 ? 'Máximo' : `${days} dias`}
            </ButtonBase>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Relatórios visíveis</p>
          <div className="flex flex-wrap gap-2">
            {REPORTS.map((report) => {
              const isSelected = selected[report.key];
              return (
                <ButtonBase
                  key={report.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelected((current) => ({ ...current, [report.key]: !current[report.key] }))}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition-colors ${isSelected ? 'border-amber-300 bg-amber-50 text-slate-900' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />}
                  {report.title}
                </ButtonBase>
              );
            })}
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}
      {isLoading && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-600">Carregando relatórios reais...</div>}

      {data && (
        <div className="space-y-4">
          <div className="admin-reports-hide-print flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>Gerado em {formatDateBR(data.generated_at)}</span>
            <span>{visibleReportCount} de {REPORTS.length} relatórios selecionados</span>
          </div>
          {visibleReportCount === 0 && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Selecione pelo menos um relatório para visualizar.</div>}
          {REPORTS.filter(({ key }) => selected[key]).map((definition) => {
            const rawReport = data.reports[definition.key];
            const section = isReportSection(rawReport)
              ? rawReport
              : { summary: rawReport || {}, rows: [] };
            const summaryEntries = flattenObject(section.summary);
            const hasData = summaryEntries.some(([, value]) => value !== null && value !== undefined && Number(value) !== 0)
              || section.rows.length > 0;
            return (
              <article key={definition.key} className="admin-report-card rounded-3xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
                <header className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-black text-slate-900">{definition.title}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{definition.description}</p>
                </header>
                {summaryEntries.length > 0 && (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {summaryEntries.map(([key, value]) => (
                      <div key={key} className="rounded-2xl bg-slate-50 p-3">
                        <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">{labelFor(key.split('.').at(-1) || key)}</dt>
                        <dd className="mt-1 text-lg font-black text-slate-900">{formatValue(key, value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {section.rows.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Dimensão</th>
                          {Object.keys(section.rows[0]).filter((key) => key !== 'label').map((key) => <th key={key} className="px-3 py-2 text-right">{labelFor(key)}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {section.rows.map((row, index) => (
                          <tr key={`${String(row.label)}-${index}`}>
                            <th className="px-3 py-2 font-bold text-slate-800">{String(row.label || '—')}</th>
                            {Object.entries(row).filter(([key]) => key !== 'label').map(([key, value]) => <td key={key} className="px-3 py-2 text-right font-semibold text-slate-700">{formatValue(key, value)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!hasData && (
                  <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Não há dados para este relatório no período selecionado.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          [data-admin-reports-print], [data-admin-reports-print] * { visibility: visible !important; }
          [data-admin-reports-print] { position: absolute; inset: 0; width: 100%; padding: 0 !important; }
          .admin-reports-controls, .admin-reports-hide-print { display: none !important; }
          .admin-report-card { break-inside: avoid; border-color: #cbd5e1 !important; box-shadow: none !important; margin-bottom: 16px; }
        }
      `}</style>
    </section>
  );
};
