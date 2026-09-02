import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Calendar as CalendarRange, TrendingUp, Users, Car, CalendarCheck, CreditCard, Star } from 'lucide-react';
import { dbService } from '../../lib/db-service';
import {
  AdminAnalyticsSummary, AnalyticsPeriodPreset, ProviderAnalyticsSummary, } from '../../types';
import { ButtonBase } from '../ui/Button';
import { formatCentsToBRL } from '../../domain/money';

const PERIODS: AnalyticsPeriodPreset[] = [7, 30, 90];

function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  dark = false,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border shadow-xs ${dark ? 'bg-slate-950 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-amber-400' : 'text-slate-500'}`}>
          {label}
        </span>
        <div className={dark ? 'text-amber-400' : 'text-amber-600'}>{icon}</div>
      </div>
      <p className="text-2xl font-black mt-2">{value}</p>
      {helper && <p className={`text-[11px] mt-1 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{helper}</p>}
    </div>
  );
}

function PeriodSelector({
  period,
  onChange,
  isLoading,
}: {
  period: AnalyticsPeriodPreset;
  onChange: (period: AnalyticsPeriodPreset) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {PERIODS.map((days) => (
        <ButtonBase
          key={days}
          type="button"
          onClick={() => onChange(days)}
          disabled={isLoading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition ${
            period === days
              ? 'bg-slate-950 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-950'
          }`}
        >
          <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
          {days} dias
        </ButtonBase>
      ))}
    </div>
  );
}

export const AdminAnalyticsPanel: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const [period, setPeriod] = useState<AnalyticsPeriodPreset>(30);
  const [summary, setSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await dbService.getAdminAnalyticsSummary(period));
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar dados analíticos reais.');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="space-y-5 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-black text-slate-900">Painel analítico do Marketplace</h2>
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Métricas calculadas a partir de reservas, pagamentos, prestadores e eventos de produto permitidos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector period={period} onChange={setPeriod} isLoading={isLoading} />
        </div>
      </div>

      {isLoading && (
        <div className="p-5 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600">
          Carregando dados analíticos reais...
        </div>
      )}

      {error && (
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-800">
          {error}
        </div>
      )}

      {!isLoading && !error && !summary && (
        <div className="p-5 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600">
          Sem dados analíticos para o período.
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Alunos ativos" value={summary.users.active_students} helper="Base ativa total" icon={<Users className="w-4 h-4" />} />
            <MetricCard label="Prestadores ativos" value={summary.supply.active_providers} helper={`${summary.supply.active_individual_providers} instrutores · ${summary.supply.active_driving_schools} CFCs`} icon={<Car className="w-4 h-4" />} />
            <MetricCard label="Reservas confirmadas" value={summary.bookings.confirmed} helper={`${summary.bookings.created} criadas no período`} icon={<CalendarCheck className="w-4 h-4" />} />
            <MetricCard label="Volume DEV pago" value={formatCentsToBRL(summary.financial_dev.paid_volume_cents)} helper={summary.financial_dev.label} icon={<CreditCard className="w-4 h-4" />} dark />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" /> Funil
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <MetricCard label="Cotações" value={summary.funnel.quotes_created} icon={<BarChart3 className="w-4 h-4" />} />
                <MetricCard label="Pagos" value={summary.funnel.payments_paid} icon={<CreditCard className="w-4 h-4" />} />
                <MetricCard label="Cotação → reserva" value={formatRate(summary.funnel.quote_to_booking_rate)} icon={<TrendingUp className="w-4 h-4" />} />
                <MetricCard label="Reserva → pago" value={formatRate(summary.funnel.booking_to_paid_rate)} icon={<TrendingUp className="w-4 h-4" />} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-3">Operação</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <MetricCard label="Concluídas" value={summary.bookings.completed} icon={<CalendarCheck className="w-4 h-4" />} />
                <MetricCard label="Canceladas" value={summary.bookings.cancelled} icon={<CalendarCheck className="w-4 h-4" />} />
                <MetricCard label="Veículos ativos" value={summary.supply.active_vehicles} icon={<Car className="w-4 h-4" />} />
                <MetricCard label="Ofertas ativas" value={summary.supply.active_offerings} icon={<BarChart3 className="w-4 h-4" />} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-3">Produto & Qualidade</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <MetricCard label="Buscas" value={summary.engagement.provider_searches} icon={<BarChart3 className="w-4 h-4" />} />
                <MetricCard label="Perfis vistos" value={summary.engagement.provider_profile_views} icon={<Users className="w-4 h-4" />} />
                <MetricCard label="Checkouts iniciados" value={summary.engagement.checkout_started} icon={<CreditCard className="w-4 h-4" />} />
                <MetricCard label="Checkouts cancelados" value={summary.engagement.checkout_cancelled} icon={<CreditCard className="w-4 h-4" />} />
                <MetricCard label="Avaliação média" value={summary.quality.rating_average ?? '—'} helper={`${summary.quality.reviews_created} reviews`} icon={<Star className="w-4 h-4" />} />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export const ProviderAnalyticsPanel: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const [period, setPeriod] = useState<AnalyticsPeriodPreset>(30);
  const [summary, setSummary] = useState<ProviderAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await dbService.getProviderAnalyticsSummary(period));
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar seu desempenho.');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" /> Meu desempenho
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Métricas reais do seu contexto autorizado no Supabase.
          </p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} isLoading={isLoading} />
      </div>

      {isLoading && <p className="text-xs font-bold text-slate-500">Carregando desempenho...</p>}
      {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}

      {summary && !isLoading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Confirmadas" value={summary.bookings.confirmed} helper={`${summary.bookings.upcoming} próximas`} icon={<CalendarCheck className="w-4 h-4" />} />
          <MetricCard label="Concluídas" value={summary.bookings.completed} helper={`${summary.bookings.cancelled} canceladas`} icon={<TrendingUp className="w-4 h-4" />} />
          <MetricCard label="Recebido DEV" value={formatCentsToBRL(summary.financial_dev.paid_volume_cents)} helper={summary.financial_dev.label} icon={<CreditCard className="w-4 h-4" />} dark />
          <MetricCard label="Avaliação" value={summary.quality.rating_average ?? '—'} helper={`${summary.quality.reviews_count} avaliações`} icon={<Star className="w-4 h-4" />} />
          <MetricCard label="Veículos ativos" value={summary.supply.active_vehicles} icon={<Car className="w-4 h-4" />} />
          <MetricCard label="Ofertas ativas" value={summary.supply.active_offerings} icon={<BarChart3 className="w-4 h-4" />} />
          <MetricCard label="Pagamentos" value={summary.financial_dev.payments_paid} icon={<CreditCard className="w-4 h-4" />} />
          <MetricCard label="Contextos" value={summary.provider_contexts} helper="Prestadores autorizados" icon={<Users className="w-4 h-4" />} />
        </div>
      )}
    </section>
  );
};
