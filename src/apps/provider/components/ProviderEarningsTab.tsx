import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RefreshCw,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { dbService } from '../../../lib/db-service';
import { formatCentsToBRL } from '../../../domain/money';
import { formatDateBR } from '../../../lib/date-format';
import { buildProviderEarningsInsights, PROVIDER_INSIGHTS_MINIMUM_STUDENTS } from '../../../domain/provider-earnings';
import type { ProviderEarningsPeriodPreset, ProviderEarningsSummary } from '../../../types';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button, ButtonBase } from '../../../components/ui/Button';

const PERIODS: ProviderEarningsPeriodPreset[] = [7, 14, 30];

function formatPeriod(period: ProviderEarningsPeriodPreset): string {
  return `${period} dias`;
}

function formatMoney(value: number | null | undefined, showZero = true): string {
  if (value == null || (!showZero && value === 0)) return '—';
  return formatCentsToBRL(value);
}

function comparisonLabel(current: number, previous: number): string | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return 'Primeiros ganhos registrados neste comparativo';
  const variation = Math.round(((current - previous) * 100) / previous);
  return `${variation >= 0 ? '+' : ''}${variation}% em relação ao período anterior`;
}

function LoadingBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-slate-200 ${className}`} />;
}

function PeriodSelector({ period, onChange, disabled = false }: { period: ProviderEarningsPeriodPreset; onChange: (value: ProviderEarningsPeriodPreset) => void; disabled?: boolean }) {
  return (
    <div className="flex w-full gap-2 rounded-2xl bg-slate-100 p-1 sm:w-auto" role="group" aria-label="Período dos ganhos">
      {PERIODS.map((item) => (
        <ButtonBase
          key={item}
          type="button"
          disabled={disabled}
          aria-pressed={period === item}
          onClick={() => onChange(item)}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition sm:flex-none ${period === item ? 'bg-[var(--mazzi-dark)] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
        >
          {formatPeriod(item)}
        </ButtonBase>
      ))}
    </div>
  );
}

function MetricCard({ label, value, helper, icon, tone = 'light' }: { label: string; value: string; helper?: string; icon: React.ReactNode; tone?: 'light' | 'warning' | 'danger' }) {
  const styles = {
    light: 'border-slate-200 bg-white text-[var(--mazzi-dark)]',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    danger: 'border-rose-200 bg-rose-50 text-rose-950',
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 shadow-2xs ${styles}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] opacity-70">{label}</span>
        <span className="text-amber-600" aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-2 text-xl font-black tracking-tight">{value}</p>
      {helper && <p className="mt-1 text-[11px] font-semibold opacity-70">{helper}</p>}
    </div>
  );
}

function EarningsSeries({ summary }: { summary: ProviderEarningsSummary }) {
  const points = summary.series;
  const max = Math.max(...points.map((point) => point.net_earned_cents), 1);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs" aria-labelledby="provider-earnings-series-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="provider-earnings-series-title" className="flex items-center gap-2 text-sm font-black text-slate-900">
            <TrendingUp className="h-4 w-4 text-amber-500" aria-hidden="true" /> Evolução dos ganhos
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Ganhos líquidos por dia do período.</p>
        </div>
        <Badge variant="default">{summary.current.lessons_completed} aulas</Badge>
      </div>
      <div className="mt-5 flex h-36 items-end gap-1.5 overflow-hidden" role="img" aria-label="Gráfico de barras dos ganhos líquidos por dia">
        {points.map((point) => {
          const height = point.net_earned_cents > 0 ? Math.max(8, Math.round((point.net_earned_cents * 100) / max)) : 3;
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${formatDateBR(point.date)}: ${formatCentsToBRL(point.net_earned_cents)}`}>
              <div className={`w-full max-w-5 rounded-t-md ${point.net_earned_cents > 0 ? 'bg-[var(--mazzi-yellow)]' : 'bg-slate-100'}`} style={{ height: `${height}%` }} />
              <span className="w-full truncate text-center text-[9px] font-semibold text-slate-400">{point.date.slice(8, 10)}/{point.date.slice(5, 7)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UpcomingPayouts({ summary }: { summary: ProviderEarningsSummary }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs" aria-labelledby="provider-upcoming-payouts-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="provider-upcoming-payouts-title" className="flex items-center gap-2 text-sm font-black text-slate-900">
            <CalendarDays className="h-4 w-4 text-amber-500" aria-hidden="true" /> Próximos repasses
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Previsão dos próximos 7 dias.</p>
        </div>
        <span className="text-sm font-black text-slate-900">{formatMoney(summary.upcoming_total_cents)}</span>
      </div>
      {summary.upcoming_payouts.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">Nenhum repasse previsto para os próximos 7 dias.</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {summary.upcoming_payouts.map((item) => (
            <div key={item.date} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold text-slate-800">{formatDateBR(item.date)}</p>
                  <p className="text-[11px] font-medium text-slate-500">{item.payout_count} {item.payout_count === 1 ? 'aula' : 'aulas'}</p>
                </div>
              </div>
              <span className="text-sm font-black text-emerald-700">{formatMoney(item.amount_in_cents)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11px] font-medium leading-relaxed text-slate-500">Repasses bloqueados não aparecem como previsão até a situação ser resolvida.</p>
    </section>
  );
}

function ReviewsCard({ summary }: { summary: ProviderEarningsSummary }) {
  const insights = buildProviderEarningsInsights(summary.reviews);
  const overall = summary.reviews.rating_overall;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs" aria-labelledby="provider-earnings-reviews-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="provider-earnings-reviews-title" className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Star className="h-4 w-4 text-amber-500" aria-hidden="true" /> Avaliações das aulas
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Dados reais das avaliações recebidas.</p>
        </div>
        {overall == null ? <Badge variant="default">Sem avaliações</Badge> : <Badge variant="success">{overall.toFixed(1)} / 5</Badge>}
      </div>

      {overall == null ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">Você ainda não recebeu avaliações.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          {Object.entries(summary.reviews.dimensions).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{key === 'didactics' ? 'Didática' : key === 'punctuality' ? 'Pontualidade' : key === 'safety' ? 'Segurança' : key === 'vehicle' ? 'Veículo' : 'Cordialidade'}</p>
              <p className="mt-1 font-black text-slate-900">{value == null ? '—' : value.toFixed(1)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        {!insights.isUnlocked ? (
          <>
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-amber-950">
              <span>Insights detalhados</span>
              <span>{insights.progress}/{PROVIDER_INSIGHTS_MINIMUM_STUDENTS} alunos avaliados</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100" aria-label={`${insights.progress} de ${PROVIDER_INSIGHTS_MINIMUM_STUDENTS} alunos avaliados`}>
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${(insights.progress * 100) / PROVIDER_INSIGHTS_MINIMUM_STUDENTS}%` }} />
            </div>
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-amber-900/80">Os pontos fortes e de atenção aparecem depois de 30 alunos distintos avaliados.</p>
          </>
        ) : insights.summary === 'balanced' ? (
          <p className="text-xs font-semibold text-amber-950">Suas dimensões estão equilibradas. Continue mantendo a consistência das aulas.</p>
        ) : (
          <div className="space-y-1 text-xs font-semibold text-amber-950">
            {insights.strongest.length > 0 && <p><span className="font-black">Pontos fortes:</span> {insights.strongest.join(', ')}.</p>}
            {insights.weakest.length > 0 && <p><span className="font-black">Ponto de atenção:</span> {insights.weakest.join(', ')}.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyEarningsState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
      <Wallet className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
      <p className="mt-2 text-sm font-black text-slate-700">Sem ganhos no período</p>
      <p className="mt-1 text-xs font-medium text-slate-500">Quando uma aula concluída gerar um payout, ela aparecerá aqui.</p>
    </div>
  );
}

export const ProviderEarningsTab: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const [period, setPeriod] = useState<ProviderEarningsPeriodPreset>(30);
  const [summary, setSummary] = useState<ProviderEarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await dbService.getProviderEarningsSummary(period));
    } catch (err: any) {
      setSummary(null);
      setError(err?.message || 'Não foi possível carregar seus ganhos.');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const comparison = useMemo(() => summary ? comparisonLabel(summary.current.net_earned_cents, summary.previous.net_earned_cents) : null, [summary]);

  return (
    <div className="space-y-5 text-left">
      <AppPageHeader eyebrow="Financeiro do PRO" title="Ganhos" subtitle="Acompanhe seus ganhos e próximos repasses." />
      <PeriodSelector period={period} onChange={setPeriod} disabled={isLoading} />

      {isLoading && (
        <div aria-busy="true" aria-label="Carregando ganhos" className="space-y-4">
          <LoadingBlock className="h-40" />
          <div className="grid grid-cols-2 gap-3"><LoadingBlock className="h-28" /><LoadingBlock className="h-28" /></div>
          <LoadingBlock className="h-56" />
        </div>
      )}

      {!isLoading && error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><p className="font-bold">Não foi possível carregar os ganhos.</p><p className="mt-1 text-xs font-medium">{error}</p><Button variant="dangerSoft" size="sm" className="mt-3" onClick={() => void load()} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}>Tentar novamente</Button></div></div>
        </div>
      )}

      {!isLoading && !error && summary && (
        <>
          <section className="rounded-3xl bg-[var(--mazzi-dark)] p-5 text-white shadow-[var(--mazzi-shadow)]" aria-labelledby="provider-earnings-main-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mazzi-yellow)]">Ganhos líquidos</p>
                <h2 id="provider-earnings-main-title" className="mt-2 text-3xl font-black tracking-tight">{formatMoney(summary.current.net_earned_cents)}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-300">{summary.current.lessons_completed} aulas concluídas nos últimos {period} dias</p>
              </div>
              <Wallet className="h-7 w-7 text-[var(--mazzi-yellow)]" aria-hidden="true" />
            </div>
            {comparison && <p className="mt-4 border-t border-white/10 pt-3 text-xs font-semibold text-slate-300">{comparison}</p>}
          </section>

          {summary.current.lessons_completed === 0 && summary.current.net_earned_cents === 0 && <EmptyEarningsState />}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Recebido" value={formatMoney(summary.current.received_cents, false)} helper="Repasses pagos" icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />} />
            <MetricCard label="A receber" value={formatMoney(summary.current.to_receive_cents, false)} helper="Pendente, disponível ou em transferência" icon={<Clock3 className="h-4 w-4" aria-hidden="true" />} />
            <MetricCard label="Bloqueado" value={formatMoney(summary.current.blocked_cents, false)} helper="Aguardando análise ou liberação" icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />} tone="warning" />
            <MetricCard label="Ticket médio líquido" value={formatMoney(summary.current.average_ticket_cents, false)} helper="Por aula com ganho" icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} />
          </div>

          {summary.current.failed_cents > 0 && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-900"><span className="font-black">Requer atenção:</span> existem {formatMoney(summary.current.failed_cents)} em repasses que falharam.</div>}

          <div className="grid gap-5 lg:grid-cols-2"><UpcomingPayouts summary={summary} /><EarningsSeries summary={summary} /></div>
          <ReviewsCard summary={summary} />
        </>
      )}
    </div>
  );
};

export const ProviderEarningsDashboardCard: React.FC<{ onNavigate: () => void; refreshKey?: number }> = ({ onNavigate, refreshKey = 0 }) => {
  const [summary, setSummary] = useState<ProviderEarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    dbService.getProviderEarningsSummary(30).then((data) => { if (active) setSummary(data); }).catch(() => { if (active) setSummary(null); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-2xs" aria-labelledby="provider-dashboard-earnings-title">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Seus ganhos</p><h2 id="provider-dashboard-earnings-title" className="mt-1 text-lg font-black text-slate-950">Últimos 30 dias</h2></div>
        <Wallet className="h-5 w-5 text-amber-700" aria-hidden="true" />
      </div>
      {isLoading ? <LoadingBlock className="mt-4 h-10 w-40" /> : summary ? (
        <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-2xl font-black text-slate-950">{formatMoney(summary.current.net_earned_cents)}</p><p className="mt-1 text-xs font-semibold text-slate-600">A receber {formatMoney(summary.current.to_receive_cents)} · Bloqueado {formatMoney(summary.current.blocked_cents)}</p></div><Button variant="outline" size="sm" onClick={onNavigate} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>Ver detalhes</Button></div>
      ) : <p className="mt-4 text-xs font-semibold text-slate-600">Ganhos temporariamente indisponíveis.</p>}
    </section>
  );
};
