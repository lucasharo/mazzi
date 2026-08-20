import React from 'react';
import {
  Clock,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Star,
  CheckCircle2,
  Calendar,
  SlidersHorizontal,
  Car,
  Plus,
} from 'lucide-react';
import { Provider, Booking, ComplianceDocument, Vehicle } from '../../../types';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { getVerificationBadgeTooltip } from '../../../domain/compliance';

interface ProviderDashboardTabProps {
  currentProvider: Provider;
  todayBookings: Booking[];
  confirmedBookings: Booking[];
  completedBookings: Booking[];
  nextBooking: Booking | null;
  providerDocs: ComplianceDocument[];
  providerVehicles: Vehicle[];
  onSelectBooking: (booking: Booking) => void;
  onNavigateTab: (tabId: 'dashboard' | 'schedule' | 'bookings' | 'management' | 'profile') => void;
  onOpenAddVehicleModal: () => void;
  onOpenAddOfferingModal: () => void;
}

export const ProviderDashboardTab: React.FC<ProviderDashboardTabProps> = ({
  currentProvider,
  todayBookings,
  confirmedBookings,
  completedBookings,
  nextBooking,
  providerDocs,
  providerVehicles,
  onSelectBooking,
  onNavigateTab,
  onOpenAddVehicleModal,
  onOpenAddOfferingModal,
}) => {
  return (
    <div className="space-y-6 text-left">
      {/* Eyebrow & Main Title */}
      <div>
        <p className="mazzi-eyebrow mb-1">Hoje</p>
        <h2 className="mazzi-title">Sua rotina operacional</h2>
      </div>

      {/* Hero Banner (MAZZI Hero split gradient) */}
      <section className="mazzi-hero">
        <div className="p-5 flex flex-col justify-between">
          <div>
            <p className="text-[38px] font-black leading-none text-[#202126]">
              {todayBookings.length}
            </p>
            <p className="mt-1.5 text-xs font-extrabold uppercase tracking-wider text-[#202126]/80">
              {todayBookings.length === 1 ? 'Aula agendada hoje' : 'Aulas agendadas hoje'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#202126]/10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#202126]/70">Confirmadas: {confirmedBookings.length}</span>
            <span className="text-[11px] font-bold text-[#202126]/70">Concluídas: {completedBookings.length}</span>
          </div>
        </div>

        <div className="p-5 flex flex-col justify-between">
          <div>
            <p className="text-[28px] font-black leading-none text-white">
              {nextBooking?.startTime || '—'}
            </p>
            <p className="mt-1.5 text-xs font-bold text-white/70">
              {nextBooking ? 'Próximo compromisso' : 'Sem agendamentos próximos'}
            </p>
          </div>
          {nextBooking && (
            <button
              type="button"
              onClick={() => onSelectBooking(nextBooking)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#f6c945] hover:underline"
            >
              <span>Ver detalhes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Compliance / Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          currentProvider.status === 'ACTIVE'
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : currentProvider.status === 'PENDING_REVIEW'
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : currentProvider.status === 'REJECTED'
            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
            : 'bg-slate-100 border-slate-300 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              currentProvider.status === 'ACTIVE'
                ? 'bg-emerald-500 text-white'
                : 'bg-amber-400 text-slate-950'
            }`}
          >
            {currentProvider.status === 'ACTIVE' ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-slate-900 text-sm">
                {currentProvider.status === 'ACTIVE' && 'Credenciamento Ativo • Verificado pela MAZZI'}
                {currentProvider.status === 'PENDING_REVIEW' && 'Cadastro em Análise pelo Compliance'}
                {currentProvider.status === 'DRAFT' && 'Cadastro em Rascunho'}
                {currentProvider.status === 'REJECTED' && 'Cadastro Rejeitado — Ação Necessária'}
                {currentProvider.status === 'SUSPENDED' && 'Cadastro Suspenso'}
              </h4>
              {currentProvider.isVerified && (
                <span
                  title={getVerificationBadgeTooltip()}
                  className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-700" />
                  Verificado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {currentProvider.status === 'ACTIVE' &&
                'Suas ofertas e horários estão visíveis para agendamentos de alunos em São Paulo.'}
              {currentProvider.status === 'PENDING_REVIEW' &&
                'Seus documentos foram recebidos e estão na fila de auditoria da equipe de moderação.'}
              {currentProvider.status === 'REJECTED' &&
                `Motivo: ${currentProvider.rejectionReason || 'Documentação não conforme.'}`}
            </p>
          </div>
        </div>
        <StatusBadge status={currentProvider.status} />
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Aulas Hoje
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{todayBookings.length}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Confirmadas
          </span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{confirmedBookings.length}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Concluídas
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{completedBookings.length}</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#202126] text-white shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#f6c945] block">
            Avaliação
          </span>
          <p className="text-xl font-black text-white mt-1 flex items-center gap-1">
            <Star className="w-4 h-4 fill-[#f6c945] text-[#f6c945]" />
            {currentProvider.ratingAverage?.toFixed(1) || '5.0'}
          </p>
        </div>
      </div>

      {/* NEXT LESSON OPERATIONAL WIDGET */}
      <div className="p-5 rounded-3xl bg-[#202126] text-[#ffffff] space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#f6c945]" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Próxima Aula Agendada
            </h3>
          </div>
          <Badge variant="warning">Próxima Aula</Badge>
        </div>

        {nextBooking ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-black text-white">{nextBooking.studentName}</p>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#f6c945]/20 text-[#f6c945] border border-[#f6c945]/40">
                    Cat. {nextBooking.category}
                  </span>
                  {(nextBooking.snapshot?.providerName || nextBooking.providerName) && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      {nextBooking.snapshot?.providerName || nextBooking.providerName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#f6c945] font-extrabold">
                  {nextBooking.scheduledDate} • {nextBooking.startTime} - {nextBooking.endTime}
                </p>
                <p className="text-xs text-slate-400">
                  Veículo: <span className="text-white font-semibold">{nextBooking.snapshot.vehicleName}</span>
                </p>
                <p className="text-xs text-slate-400">
                  Encontro: <span className="text-white font-semibold">{formatMeetingPoint(nextBooking.meetingPoint)}</span>
                </p>
              </div>

              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <StatusBadge status={nextBooking.status} />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSelectBooking(nextBooking)}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Abrir Detalhes & Check-in
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs font-semibold">
            Nenhuma aula confirmada agendada para os próximos horários.
          </div>
        )}
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('schedule')}
          className="p-4 rounded-2xl bg-white border border-[#e9e6de] hover:border-slate-400 transition text-left flex items-center justify-between group shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-[#202126] font-bold flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-amber-600 transition">
                Gerenciar Agenda & Horários
              </h4>
              <p className="text-xs text-slate-500">Configure regras semanais e bloqueios</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('management')}
          className="p-4 rounded-2xl bg-white border border-[#e9e6de] hover:border-slate-400 transition text-left flex items-center justify-between group shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#202126] font-bold flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-slate-700 transition">
                Gestão de Veículos & Ofertas
              </h4>
              <p className="text-xs text-slate-500">Cadastre modelos, categorias e preços</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
        </button>
      </div>

      {/* Operational Alerts */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
        <div className="flex items-center gap-2 font-extrabold">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span>Alertas da Operação MAZZI Pro:</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-amber-800 font-medium">
          {providerDocs.some((d) => d.status === 'PENDING' || d.status === 'UNDER_REVIEW') && (
            <li>Você possui documentos aguardando análise de compliance.</li>
          )}
          {providerVehicles.length === 0 && (
            <li>
              Nenhum veículo cadastrado.{' '}
              <button
                type="button"
                onClick={onOpenAddVehicleModal}
                className="underline font-bold hover:text-amber-950 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Cadastrar Veículo
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};
