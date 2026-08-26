// ============================================================================
// MAZZI PLATFORM — SPRINT 12: ADMIN APP MODULAR COMPONENTS
// File: src/apps/admin/AdminComponents.tsx
// ============================================================================

import React, { useState } from 'react';
import { ShieldAlert, FileCheck2, CalendarCheck, TrendingUp, History, CheckCircle2, XCircle, Eye, EyeOff, Search, Filter, UserCheck, AlertTriangle, FileText, ShieldCheck, Ban, Settings, DollarSign, Users, Lock, ArrowRightLeft, Info, Calendar, Layers, MapPin, RefreshCw, Car, ArrowRight, } from 'lucide-react';
import {
  Provider, ComplianceDocument, Vehicle, Booking, AuditLog, User, UserRole, BookingStatus, } from '../../types';
import { Button, ButtonBase } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { formatCentsToBRL } from '../../domain/money';
import { PlatformConfiguration } from '../../domain/platform-config';
import { AuthContext } from '../../domain/rbac';
import { isVehicleAwaitingAdminReview } from '../../domain/vehicles-offerings';

// Utility for masking plates
export function formatMaskedPlate(plate: string, isExpanded: boolean): string {
  if (isExpanded) return plate;
  if (!plate) return '***-****';
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 7) return '***-****';
  return `${clean.substring(0, 3)}-***${clean.substring(clean.length - 1)}`;
}

// Utility for masking sensitive personal info
export function maskSensitiveValue(value: string, isExpanded: boolean, type: 'CPF' | 'CNPJ' | 'PHONE'): string {
  if (isExpanded) return value;
  if (!value) return '---';
  if (type === 'PHONE') {
    return value.replace(/(\(\d{2}\)\s*\d)\d{4}/, '$1****');
  }
  if (type === 'CPF') {
    return value.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '$1.***.***-$4');
  }
  if (type === 'CNPJ') {
    return value.replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/, '$1.***.***/****-$5');
  }
  return '***';
}

// ============================================================================
// 1. DASHBOARD TAB
// ============================================================================
export const DashboardTab: React.FC<{
  providers: Provider[];
  complianceDocs: ComplianceDocument[];
  vehicles: Vehicle[];
  bookings: Booking[];
  auditLogs: AuditLog[];
  onNavigate: (tabId: string) => void;
}> = ({ providers, complianceDocs, vehicles, bookings, auditLogs, onNavigate }) => {
  // Compute real metrics
  const activeProviders = providers.filter((p) => p.status === 'ACTIVE').length;
  const pendingReviewProviders = providers.filter((p) => p.status === 'PENDING_REVIEW').length;
const pendingDocs = complianceDocs.filter((d) => d.status === 'PENDING' || d.status === 'IN_REVIEW').length;
const expiringDocsCount = complianceDocs.filter((d) => d.expiresAt && new Date(d.expiresAt).getTime() < Date.now()).length;
  const vehiclesUnderReview = vehicles.filter((v) => isVehicleAwaitingAdminReview(v.status)).length;
  
  const todayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const todayISO = ['year', 'month', 'day']
    .map((part) => todayParts.find((item) => item.type === part)?.value)
    .join('-');
  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
  }).format(new Date());
  const bookingsToday = bookings.filter((b) => {
    const bookingParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(b.scheduledStartAt));
    return ['year', 'month', 'day']
      .map((part) => bookingParts.find((item) => item.type === part)?.value)
      .join('-') === todayISO;
  }).length;
  const bookingsConfirmed = bookings.filter((b) => b.status === 'CONFIRMED').length;
  const bookingsDisputed = bookings.filter((b) => b.status === 'DISPUTED').length;

  // Generate dynamic operational alerts
  const alerts: { id: string; type: 'warning' | 'error' | 'info'; text: string; actionText: string; tab: string }[] = [];
  if (pendingReviewProviders > 0) {
    alerts.push({
      id: 'alert_prov',
      type: 'warning',
      text: `Há ${pendingReviewProviders} prestador(es) aguardando homologação e credenciamento.`,
      actionText: 'Analisar Fila',
      tab: 'providers',
    });
  }
  if (pendingDocs > 0) {
    alerts.push({
      id: 'alert_docs',
      type: 'info',
      text: `Existem ${pendingDocs} documento(s) pendentes na fila de compliance regulatório.`,
      actionText: 'Auditar Compliance',
      tab: 'compliance',
    });
  }
  if (vehiclesUnderReview > 0) {
    alerts.push({
      id: 'alert_veh',
      type: 'warning',
      text: `Há ${vehiclesUnderReview} veículo(s) sob revisão aguardando aprovação para oferta comercial.`,
      actionText: 'Analisar Veículos',
      tab: 'vehicles',
    });
  }
  if (bookingsDisputed > 0) {
    alerts.push({
      id: 'alert_disp',
      type: 'error',
      text: `Atenção: ${bookingsDisputed} aula(s) de direção prática estão sinalizadas em disputa comercial (DISPUTED).`,
      actionText: 'Gerenciar Disputas',
      tab: 'bookings',
    });
  }
  if (expiringDocsCount > 0) {
    alerts.push({
      id: 'alert_exp',
      type: 'error',
      text: `Alerta Regulatório: ${expiringDocsCount} documento(s) expirados exigem suspensão ou renovação imediata.`,
      actionText: 'Verificar Validade',
      tab: 'compliance',
    });
  }

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Visão Geral da Plataforma</h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Indicadores operacionais reais e alertas do marketplace de instrução prática.
        </p>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-950 text-white border border-slate-900 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">MARKETPLACE HEALTH</span>
            <h4 className="text-xs font-bold text-slate-300 mt-0.5">Liquidez e Crescimento</h4>
          </div>
          <div className="my-3">
            <p className="text-3xl font-black">{activeProviders}</p>
            <p className="text-[10px] text-slate-400 font-medium">Prestadores Credenciados Ativos</p>
          </div>
          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Compliance monitorado na fila operacional
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">ONBOARDING PIPELINE</span>
            <h4 className="text-xs font-bold text-slate-700 mt-0.5">Homologação de Parceiros</h4>
          </div>
          <div className="my-3">
            <p className="text-3xl font-black text-slate-900">{pendingReviewProviders}</p>
            <p className="text-[10px] text-slate-500 font-medium">Prestadores Aguardando Análise</p>
          </div>
          <ButtonBase onClick={() => onNavigate('providers')} className="inline-flex items-center gap-1.5 text-left text-xs font-bold text-indigo-600 hover:text-indigo-800">
            Verificar fila <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </ButtonBase>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">VEHICLE HOMOLOGATION</span>
            <h4 className="text-xs font-bold text-slate-700 mt-0.5">Fila de Frota</h4>
          </div>
          <div className="my-3">
            <p className="text-3xl font-black text-slate-900">{vehiclesUnderReview}</p>
            <p className="text-[10px] text-slate-500 font-medium">Veículos Sob Análise</p>
          </div>
          <ButtonBase onClick={() => onNavigate('vehicles')} className="inline-flex items-center gap-1.5 text-left text-xs font-bold text-indigo-600 hover:text-indigo-800">
            Homologar veículos <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </ButtonBase>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">OPERATIONAL TRAFFIC</span>
            <h4 className="text-xs font-bold text-slate-700 mt-0.5">Volume de Aulas Hoje</h4>
          </div>
          <div className="my-3">
            <p className="text-3xl font-black text-slate-900">{bookingsToday}</p>
            <p className="text-[10px] text-slate-500 font-medium">Reservas para {todayLabel}</p>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {bookingsConfirmed} confirmadas • {bookingsDisputed} em disputa
          </span>
        </div>
      </div>

      {/* Alertas Operacionais Dinâmicos */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Alertas de Governança & Segurança ({alerts.length})
        </h3>

        {alerts.length === 0 ? (
          <div className="p-5 rounded-2xl border border-dashed border-slate-300 text-center bg-slate-50 text-xs text-slate-500">
            Excelente! Nenhum alerta crítico pendente de intervenção administrativa.
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                  a.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : a.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      a.type === 'error' ? 'text-rose-600' : a.type === 'warning' ? 'text-amber-600' : 'text-indigo-600'
                    }`}
                  />
                  <div>
                    <span className="font-extrabold block">
                      {a.type === 'error' ? 'ALERTA REGULATÓRIO CRÍTICO' : a.type === 'warning' ? 'REVISÃO OPERACIONAL PENDENTE' : 'AÇÃO RECOMENDADA'}
                    </span>
                    <p className="font-medium text-slate-700 mt-0.5">{a.text}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${
                    a.type === 'error'
                      ? 'border-rose-300 hover:bg-rose-100 text-rose-900'
                      : a.type === 'warning'
                      ? 'border-amber-300 hover:bg-amber-100 text-amber-900'
                      : 'border-indigo-300 hover:bg-indigo-100 text-indigo-900'
                  }`}
                  onClick={() => onNavigate(a.tab)}
                >
                  {a.actionText}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gateway de Pagamentos Informativo */}
      <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-950">Nota de Desenvolvimento (Simulado)</span>
          <p className="text-amber-800 mt-0.5 leading-relaxed">
            Todas as métricas de faturamento e operações financeiras utilizam a biblioteca de integração{' '}
            <code className="bg-amber-100 text-amber-950 font-mono px-1 rounded text-[11px]">DEVELOPMENT_FAKE_PAYMENT</code>.{' '}
            As ações de reembolso simulam webhooks de transação reversa, gerando logs de auditoria correspondentes sem conexões com gateways reais de produção.
          </p>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 2. PROVIDERS TAB
// ============================================================================
export const ProvidersTab: React.FC<{
  providers: Provider[];
  complianceDocs: ComplianceDocument[];
  vehicles: Vehicle[];
  auditLogs: AuditLog[];
  actor: AuthContext;
  onApprove: (p: Provider) => void;
  onReject: (p: Provider, reason: string) => void;
  onSuspend: (p: Provider, reason: string) => void;
  onBlock: (p: Provider, reason: string) => void;
  eligibilityChecker: (p: Provider, docs: ComplianceDocument[]) => { isEligible: boolean; approvedCount: number; mandatoryRequirementsCount: number; ineligibilityReasons: string[] };
}> = ({ providers, complianceDocs, vehicles, auditLogs, actor, onApprove, onReject, onSuspend, onBlock, eligibilityChecker }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProvId, setSelectedProvId] = useState<string>(providers[0]?.id || '');
  const [showSensitive, setShowSensitive] = useState<boolean>(false);

  // Rejection/Suspension modals inside component
  const [actionType, setActionType] = useState<'REJECT' | 'SUSPEND' | 'BLOCK' | null>(null);
  const [reasonText, setReasonText] = useState<string>('');

  const selectedProv = providers.find((p) => p.id === selectedProvId) || providers[0];
  const selectedProvDocs = selectedProv ? complianceDocs.filter((d) =>
    d.providerId === selectedProv.id ||
    (selectedProv.type === 'INSTRUCTOR' && d.scope === 'USER_GLOBAL' && d.userId === selectedProv.userId)
  ) : [];
  const selectedProvVehicles = selectedProv ? vehicles.filter((v) => v.providerId === selectedProv.id) : [];
  const selectedProvLogs = selectedProv ? auditLogs.filter((log) => log.entityId === selectedProv.id || log.previousValue?.includes(selectedProv.id) || log.newValue?.includes(selectedProv.id)) : [];

  const eligibility = selectedProv ? eligibilityChecker(selectedProv, selectedProvDocs) : null;

  const filteredProviders = providers.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.documentNumber && p.documentNumber.includes(searchTerm));
    const matchesType = filterType === 'ALL' || p.type === filterType;
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleConfirmAction = () => {
    if (!selectedProv || !reasonText.trim()) return;
    if (actionType === 'REJECT') {
      onReject(selectedProv, reasonText);
    } else if (actionType === 'SUSPEND') {
      onSuspend(selectedProv, reasonText);
    } else if (actionType === 'BLOCK') {
      onBlock(selectedProv, reasonText);
    }
    setActionType(null);
    setReasonText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Coluna Esquerda: Listagem e Filtros */}
      <div className="lg:col-span-1 space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Filtros de Prestadores</h3>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 text-xs"
              placeholder="Pesquisar por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo</label>
              <Select
                label="Tipo"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                options={[
                  { value: 'ALL', label: 'Todos os Tipos' },
                  { value: 'INSTRUCTOR', label: 'Instrutores' },
                  { value: 'DRIVING_SCHOOL', label: 'Autoescolas' },
                ]}
              />
            </div>
            <div>
              <Select
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'Todos os Status' },
                  { value: 'PENDING_REVIEW', label: 'Análise' },
                  { value: 'ACTIVE', label: 'Ativos' },
                  { value: 'SUSPENDED', label: 'Suspensos' },
                  { value: 'REJECTED', label: 'Rejeitados' },
                  { value: 'BLOCKED', label: 'Bloqueados' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resultados ({filteredProviders.length})</h4>
          </div>
          {filteredProviders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed rounded-2xl bg-slate-50">
              Nenhum parceiro atende aos critérios informados.
            </div>
          ) : (
            filteredProviders.map((p) => {
              const isSelected = p.id === selectedProv?.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProvId(p.id);
                    setShowSensitive(false);
                  }}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-950 text-white border-slate-900 shadow-md'
                      : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase ${
                        isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {p.type === 'INSTRUCTOR' ? 'Instrutor' : 'CFC'}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <h5 className="font-bold text-xs mt-2 line-clamp-1">{p.name}</h5>
                  <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                    {p.neighborhood}, {p.city}
                  </p>
                  <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-200/20 flex items-center justify-between text-[10px]">
                    <span className="opacity-80">Docs: {complianceDocs.filter((d) => d.providerId === p.id && d.status === 'APPROVED').length} OK</span>
                    <span className="opacity-80">Veículos: {vehicles.filter((v) => v.providerId === p.id).length}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Coluna Direita: Ficha de Detalhes Completa */}
      <div className="lg:col-span-2 space-y-6">
        {selectedProv ? (
          <div className="space-y-6">
            {/* Header do Parceiro */}
            <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">{selectedProv.name}</h3>
                    <StatusBadge status={selectedProv.status} />
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium mt-1">
                    Razão Social/Civil: <span className="text-slate-400 font-bold">{selectedProv.legalName || 'Não informada'}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-4">
                    <span>
                      Identificação:{' '}
                      <span className="font-mono text-amber-300 font-bold">
                        {maskSensitiveValue(
                          selectedProv.documentNumber || '',
                          showSensitive,
                          selectedProv.type === 'INSTRUCTOR' ? 'CPF' : 'CNPJ'
                        )}
                      </span>
                    </span>
                    <span>
                      Contato comercial:{' '}
                      <span className="font-mono text-slate-300 font-bold">
                        {maskSensitiveValue(selectedProv.phone || '', showSensitive, 'PHONE')}
                      </span>
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-400 hover:text-amber-300 border border-amber-500/20 self-start sm:self-auto"
                    leftIcon={showSensitive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setShowSensitive(!showSensitive);
                      if (!showSensitive) {
                        // Real audit trails must be persisted by backend/RPC flows. Avoid logging sensitive identifiers in browser console.
                        if ((import.meta as any).env?.DEV) {
                          console.debug('[MAZZI_PRIVACY_DEBUG]', { unmaskedProviderDataViewed: true });
                        }
                      }
                    }}
                  >
                    {showSensitive ? 'Ocultar Identificadores' : 'Exibir Identificadores'}
                  </Button>
                </div>
              </div>

              {/* Banner de Elegibilidade Regulatória */}
              {eligibility && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    eligibility.isEligible
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      Motor de Compliance de Elegibilidade
                    </div>
                    <p className="text-[11px] opacity-90 leading-relaxed">
                      {eligibility.isEligible
                        ? 'Todos os requisitos obrigatórios regulatórios para a categoria comercial foram analisados, aprovados e estão válidos.'
                        : `Atenção: Credenciamento bloqueado. Pendências: ${eligibility.ineligibilityReasons.join('; ')}`}
                    </p>
                  </div>
                  <span className="bg-slate-900/40 border border-current font-extrabold text-[10px] px-2.5 py-1 rounded-full shrink-0 self-start sm:self-auto uppercase">
                    {eligibility.approvedCount}/{eligibility.mandatoryRequirementsCount} Requisitos
                  </span>
                </div>
              )}
            </div>

            {/* Documentos Relacionados */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Documentos Enviados ({selectedProvDocs.length})</h4>
              {selectedProvDocs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed rounded-xl bg-slate-50">
                  Nenhum documento cadastrado na conta.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedProvDocs.map((doc) => (
                    <div key={doc.id} className="p-3 border rounded-xl bg-white flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-xs truncate" title={doc.title}>{doc.title}</span>
                        <StatusBadge status={doc.status} domain="compliance" />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono leading-none truncate">
                        Expiração: {doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString() : 'N/A'}
                      </p>
                      {doc.rejectionReason && (
                        <p className="text-[10px] text-rose-600 font-bold mt-1 line-clamp-1">Recusa: {doc.rejectionReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Veículos Relacionados */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Veículos Cadastrados ({selectedProvVehicles.length})</h4>
              {selectedProvVehicles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed rounded-xl bg-slate-50">
                  Nenhum veículo vinculado a este prestador.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedProvVehicles.map((v) => (
                    <div key={v.id} className="p-3 border rounded-xl bg-white flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-xs">{v.brand} {v.model} ({v.year})</span>
                        <StatusBadge status={v.status} />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-bold">
                        Placa: <span className="font-mono text-indigo-600">{formatMaskedPlate(v.licensePlate, showSensitive)}</span> • Categoria {v.category}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações Administrativas de Transição de Estado */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Controles e Ações de Moderação</h4>
                <p className="text-[11px] text-slate-500">
                  Transições de estado com suporte a restrições e justificativas oficiais de segurança.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Aprovação Credenciamento */}
                {selectedProv.status === 'PENDING_REVIEW' && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!eligibility?.isEligible}
                    leftIcon={<UserCheck className="w-4.5 h-4.5" />}
                    onClick={() => onApprove(selectedProv)}
                  >
                    Aprovar & Credenciar
                  </Button>
                )}

                {/* 2. Rejeição Credenciamento */}
                {selectedProv.status === 'PENDING_REVIEW' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={() => setActionType('REJECT')}
                  >
                    Rejeitar Cadastro
                  </Button>
                )}

                {/* 3. Suspensão temporária */}
                {selectedProv.status === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-700 border-amber-200 hover:bg-amber-50"
                    onClick={() => setActionType('SUSPEND')}
                  >
                    Suspender Prestador
                  </Button>
                )}

                {/* 4. Bloqueio definitivo administrativamente */}
                {selectedProv.status !== 'BLOCKED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-slate-900 border-slate-300 hover:bg-slate-100"
                    leftIcon={<Ban className="w-3.5 h-3.5" />}
                    onClick={() => setActionType('BLOCK')}
                  >
                    Lockdown Administrativo (Bloquear)
                  </Button>
                )}

                {selectedProv.status === 'BLOCKED' && (
                  <span className="text-[11px] text-rose-600 font-extrabold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> BLOQUEADO administrativamente sob lockdown. Reativação exige arbitramento.
                  </span>
                )}
              </div>
            </div>

            {/* Trilha de Auditoria Relacionada */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico de Auditoria do Parceiro ({selectedProvLogs.length})</h4>
              {selectedProvLogs.length === 0 ? (
                <p className="text-[11px] text-slate-400">Nenhum evento registrado especificamente para este parceiro.</p>
              ) : (
                <div className="max-h-[160px] overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50">
                  {selectedProvLogs.map((log) => (
                    <div key={log.id} className="text-[11px] p-2 bg-white rounded border border-slate-200 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-extrabold font-mono text-slate-900">{log.action}</span>
                        <p className="text-slate-500">Por {log.actorName} ({log.actorRole})</p>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px] shrink-0">{new Date(log.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-3xl">
            Selecione um prestador na lista ao lado para inspecionar os detalhes regulatórios.
          </div>
        )}
      </div>

      {/* Modais de Moderação */}
      {actionType && (
        <Modal
          isOpen
          onClose={() => setActionType(null)}
          title={actionType === 'REJECT' ? 'Confirmar Rejeição do Cadastro' : actionType === 'SUSPEND' ? 'Suspender Prestador' : 'Confirmar Lockdown / Bloqueio'}
          footer={(
            <>
              <Button variant="dangerSoft" size="sm" onClick={() => setActionType(null)}>Cancelar</Button>
              <Button
                variant="primary"
                size="sm"
                className={actionType === 'BLOCK' ? 'bg-slate-950 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
                onClick={handleConfirmAction}
                disabled={!reasonText.trim()}
              >
                Confirmar
              </Button>
            </>
          )}
        >
          <div className="space-y-4 text-left">
            <p className="text-xs text-slate-500">
              {actionType === 'BLOCK'
                ? 'Ação grave reservada a PLATFORM_ADMIN. Esta conta de prestador e todas as suas ofertas serão sumariamente ocultadas do catálogo, bloqueando transações comerciais.'
                : 'Esta ação altera o status do prestador na plataforma. Um e-mail/notificação com a justificativa de segurança será enviado.'}
            </p>
            <Textarea
              label="Justificativa Operacional Obrigatória *"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Informe detalhadamente os motivos regulatórios, técnicos ou fiscais para esta decisão..."
              rows={4}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};


// ============================================================================
// 3. COMPLIANCE TAB
// ============================================================================
export const ComplianceTab: React.FC<{
  complianceDocs: ComplianceDocument[];
  actor: AuthContext;
  onApproveDoc: (doc: ComplianceDocument) => void;
  onRejectDoc: (doc: ComplianceDocument, reason: string) => void;
}> = ({ complianceDocs, actor, onApproveDoc, onRejectDoc }) => {
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const filteredDocs = complianceDocs.filter((d) =>
    filterStatus === 'ALL'
      || (filterStatus === 'PENDING' ? d.status === 'PENDING' || d.status === 'IN_REVIEW' : filterStatus === 'EXPIRED'
        ? Boolean(d.expiresAt && new Date(d.expiresAt).getTime() < Date.now())
        : d.status === filterStatus)
  );
  const selectedDoc = complianceDocs.find((d) => d.id === selectedDocId) || filteredDocs[0];

  const handleApprove = (doc: ComplianceDocument) => {
    onApproveDoc(doc);
  };

  const handleReject = () => {
    if (!selectedDoc || !rejectionReason.trim()) return;
    onRejectDoc(selectedDoc, rejectionReason);
    setIsRejecting(false);
    setRejectionReason('');
  };

  const expiringDocs = complianceDocs.filter((d) => d.expiresAt && new Date(d.expiresAt).getTime() < Date.now());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Coluna Esquerda: Fila e Alertas de Validade */}
      <div className="lg:col-span-1 space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Fila de Documentos</h3>
          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setSelectedDocId('');
            }}
            options={[
              { value: 'PENDING', label: `Pendente (${complianceDocs.filter(d => d.status === 'PENDING' || d.status === 'IN_REVIEW').length})` },
              { value: 'APPROVED', label: `Aprovados (${complianceDocs.filter(d => d.status === 'APPROVED').length})` },
              { value: 'REJECTED', label: `Rejeitados (${complianceDocs.filter(d => d.status === 'REJECTED').length})` },
              { value: 'EXPIRED', label: `Expirados (${complianceDocs.filter(d => d.expiresAt && new Date(d.expiresAt).getTime() < Date.now()).length})` },
              { value: 'ALL', label: `Todos os Documentos (${complianceDocs.length})` },
            ]}
          />
        </div>

        {expiringDocs.length > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
            <span className="text-[10px] font-black text-rose-800 uppercase tracking-wide block">⚠️ Documentos Expirados ({expiringDocs.length})</span>
            <p className="text-[11px] text-rose-700 leading-tight">
              A validade de credenciais expirou. Recomenda-se alertar o prestador ou suspender a conta caso não haja reenvio.
            </p>
          </div>
        )}

        <div className="space-y-2 max-h-[450px] overflow-y-auto">
          {filteredDocs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50">
              Nenhum documento nesta fila de análise.
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isSelected = doc.id === selectedDoc?.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`p-3 rounded-2xl border transition cursor-pointer text-xs ${
                    isSelected ? 'bg-slate-950 text-white border-slate-900 shadow-md' : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold line-clamp-1">{doc.title}</span>
<StatusBadge status={doc.status} domain="compliance" />
                  </div>
                  <p className={`text-[11px] mt-1 truncate opacity-80`}>Prestador: {doc.providerName || 'N/A'}</p>
                  <p className={`text-[10px] mt-0.5 font-mono opacity-60`}>Enviado em: {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Coluna Direita: Detalhes, Visualização de Arquivos Simulados e Análise */}
      <div className="lg:col-span-2 space-y-6">
        {selectedDoc ? (
          <div className="space-y-6 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedDoc.title}</h3>
                  <p className="text-[11px] text-slate-500">ID de Auditoria do Arquivo: <span className="font-mono text-indigo-600 font-bold">{selectedDoc.id}</span></p>
                </div>
<StatusBadge status={selectedDoc.status} domain="compliance" />
              </div>
              <div className="text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4">
                <p>Prestador: <strong>{selectedDoc.providerName || 'Não informado'}</strong></p>
                <p>Categoria Requisito: <strong className="font-mono">{selectedDoc.type}</strong></p>
                <p>Data do Envio: <strong>{new Date(selectedDoc.uploadedAt).toLocaleString()}</strong></p>
                <p>Data de Expiração: <strong>{selectedDoc.expiresAt ? new Date(selectedDoc.expiresAt).toLocaleDateString() : 'Não informada'}</strong></p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              Documento armazenado em bucket privado. O painel exibe somente os metadados necessários para a decisão de compliance.
            </div>

            {selectedDoc.rejectionReason && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-800 font-medium">
                Motivo de Recusa Registrado: <span className="font-bold">{selectedDoc.rejectionReason}</span>
              </div>
            )}

            {/* Controles de Aprovação */}
{(selectedDoc.status === 'PENDING' || selectedDoc.status === 'IN_REVIEW') && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase">Parecer de Análise Regulatória</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    O parecer é auditado na trilha de segurança do sistema.
                  </p>
                </div>

                {!isRejecting ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => handleApprove(selectedDoc)}
                    >
                      Aprovar Documento
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                      leftIcon={<XCircle className="w-4 h-4" />}
                      onClick={() => setIsRejecting(true)}
                    >
                      Rejeitar Documento
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 block uppercase">Motivo detalhado da recusa *</label>
                      <Input
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Ex: EAR não está averbado ou CNH vencida..."
                        className="text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={handleReject} disabled={!rejectionReason.trim()}>
                        Confirmar Rejeição
                      </Button>
                  <Button variant="dangerSoft" size="sm" onClick={() => { setIsRejecting(false); setRejectionReason(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-3xl">
            Selecione um documento na fila de compliance para realizar a análise.
          </div>
        )}

        {/* Quadro Estático de Requisitos Regulatórios do MVP */}
        <div className="p-5 border rounded-3xl bg-slate-50 text-xs text-slate-600 space-y-3">
          <h4 className="font-bold text-slate-900 uppercase text-xs">Quadro de Requisitos Obrigatórios do MVP</h4>
          <p className="text-[11px] leading-relaxed">
            Conforme a regulamentação brasileira (Código de Trânsito Brasileiro e resoluções do CONTRAN), o credenciamento de parceiros exige:
          </p>
          <ul className="space-y-2 list-disc pl-4 text-[11px] font-medium text-slate-700">
            <li><strong>Instrutores (Pessoa Física):</strong> CNH categoria correspondente ativa, Credencial Oficial homologada pelo DETRAN (com código de validação), Certificado de Antecedentes Criminais negativo (expedido nos últimos 90 dias).</li>
            <li><strong>Autoescolas (CFC - Pessoa Jurídica):</strong> CNPJ cadastrado, Certificado de Credenciamento do DETRAN ativo, Portaria de Autorização de Funcionamento e documentação da frota cadastrada.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 4. VEHICLES TAB
// ============================================================================
export const VehiclesTab: React.FC<{
  vehicles: Vehicle[];
  providers: Provider[];
  onApproveVehicle: (veh: Vehicle) => void;
  onRejectVehicle: (veh: Vehicle, reason: string) => void;
  onBlockVehicle: (veh: Vehicle, reason: string) => void;
}> = ({ vehicles, providers, onApproveVehicle, onRejectVehicle, onBlockVehicle }) => {
const [filterStatus, setFilterStatus] = useState<string>('IN_REVIEW');
  const [selectedVehId, setSelectedVehId] = useState<string>('');
  const [showFullPlate, setShowFullPlate] = useState<boolean>(false);
  
  // Rejection/Block dialog state
  const [actionType, setActionType] = useState<'REJECT' | 'BLOCK' | null>(null);
  const [reason, setReason] = useState<string>('');

  const filteredVehicles = vehicles.filter((v) => filterStatus === 'AWAITING_REVIEW'
    ? isVehicleAwaitingAdminReview(v.status)
    : filterStatus === 'ALL' || v.status === filterStatus);
  const selectedVeh = vehicles.find((v) => v.id === selectedVehId) || filteredVehicles[0];
  const selectedVehProvider = selectedVeh ? providers.find((p) => p.id === selectedVeh.providerId) : null;

  const handleConfirmAction = () => {
    if (!selectedVeh || !reason.trim()) return;
    if (actionType === 'REJECT') {
      onRejectVehicle(selectedVeh, reason);
    } else if (actionType === 'BLOCK') {
      onBlockVehicle(selectedVeh, reason);
    }
    setActionType(null);
    setReason('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Coluna Esquerda: Listagem */}
      <div className="lg:col-span-1 space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Homologação de Veículos</h3>
          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setSelectedVehId('');
            }}
            options={[
              { value: 'AWAITING_REVIEW', label: `Aguardando aprovação (${vehicles.filter(v => isVehicleAwaitingAdminReview(v.status)).length})` },
              { value: 'PENDING', label: `Pendente novo (${vehicles.filter(v => v.status === 'PENDING').length})` },
              { value: 'IN_REVIEW', label: `Em revisão (${vehicles.filter(v => v.status === 'IN_REVIEW').length})` },
              { value: 'ACTIVE', label: `Ativos (${vehicles.filter(v => v.status === 'ACTIVE').length})` },
              { value: 'BLOCKED', label: `Bloqueados (${vehicles.filter(v => v.status === 'BLOCKED').length})` },
              { value: 'INACTIVE', label: `Inativos (${vehicles.filter(v => v.status === 'INACTIVE').length})` },
              { value: 'ALL', label: `Todos os Veículos (${vehicles.length})` },
            ]}
          />
        </div>

        <div className="space-y-2 max-h-[450px] overflow-y-auto">
          {filteredVehicles.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50">
              Nenhum veículo nesta fila.
            </div>
          ) : (
            filteredVehicles.map((v) => {
              const isSelected = v.id === selectedVeh?.id;
              const owner = providers.find((p) => p.id === v.providerId);
              return (
                <div
                  key={v.id}
                  onClick={() => {
                    setSelectedVehId(v.id);
                    setShowFullPlate(false);
                  }}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer text-xs ${
                    isSelected ? 'bg-slate-950 text-white border-slate-900 shadow-md' : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-extrabold">{v.brand} {v.model} ({v.year})</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">Placa: {formatMaskedPlate(v.licensePlate, false)} • Cat: {v.category}</p>
                  <p className="text-[10px] opacity-60 truncate mt-0.5">Proprietário: {owner?.name || 'N/A'}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Coluna Direita: Ficha do Veículo */}
      <div className="lg:col-span-2 space-y-6">
        {selectedVeh ? (
          <div className="space-y-6 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedVeh.brand} {selectedVeh.model}</h3>
                  <p className="text-[11px] text-slate-500">Ano de Fabricação: <span className="font-bold">{selectedVeh.year}</span></p>
                </div>
                <StatusBadge status={selectedVeh.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 text-[11px] text-slate-600 mt-2">
                <p>Proprietário: <span className="font-bold text-slate-900">{selectedVehProvider?.name || 'Não localizado'}</span></p>
                <p>Tipo do Veículo: <strong className="font-mono">{selectedVeh.vehicleType}</strong></p>
                <p>Categoria: <strong>Categoria {selectedVeh.category}</strong></p>
                <p>Câmbio: <strong>{selectedVeh.transmission === 'MANUAL' ? 'Manual' : selectedVeh.transmission === 'AUTOMATIC' ? 'Automático' : 'N/A'}</strong></p>
                <p>Cor cadastrada: <strong>{selectedVeh.color || 'Não informada'}</strong></p>
              </div>
            </div>

            {/* Placa Protegida (Anti-Scraping / LGPD) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-900">Placa Operacional (Dado Privado)</span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Disponível apenas para moderadores autorizados durante auditoria veicular.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-xs bg-slate-200 text-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-300">
                  {formatMaskedPlate(selectedVeh.licensePlate, showFullPlate)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFullPlate(!showFullPlate)}
                >
                  {showFullPlate ? 'Ocultar' : 'Exibir'}
                </Button>
              </div>
            </div>

            {selectedVeh.description && (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border font-medium">
                <strong>Notas / Logs veiculares:</strong> {selectedVeh.description}
              </p>
            )}

            {/* Ações Homologação */}
            {isVehicleAwaitingAdminReview(selectedVeh.status) && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase">Ações Administrativas da Frota</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Homologue veículos em conformidade ou reprove de volta ao rascunho com notas de correção.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<CheckCircle2 className="w-4.5 h-4.5" />}
                    onClick={() => onApproveVehicle(selectedVeh)}
                  >
                    Aprovar & Ativar Veículo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={() => setActionType('REJECT')}
                  >
                    Reprovar (Inativar)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-slate-900 border-slate-300 hover:bg-slate-100"
                    onClick={() => setActionType('BLOCK')}
                  >
                    Bloquear Veículo
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-3xl">
            Selecione um veículo na fila de homologação para analisar os detalhes.
          </div>
        )}
      </div>

      {/* Modal Rejeição/Bloqueio Veículo */}
      {actionType && (
        <Modal
          isOpen
          onClose={() => setActionType(null)}
          title={actionType === 'REJECT' ? 'Reprovar Veículo' : 'Confirmar Bloqueio de Veículo'}
          footer={(
            <>
              <Button variant="dangerSoft" size="sm" onClick={() => setActionType(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleConfirmAction} disabled={!reason.trim()}>Confirmar</Button>
            </>
          )}
        >
          <div className="space-y-4 text-left">
            <p className="text-xs text-slate-500">Informe o motivo operacional para a reprovação ou bloqueio do veículo na plataforma.</p>
            <Textarea
              label="Motivo *"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Categoria incoerente com o modelo, documentação anual incompleta..."
              rows={3}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};


// ============================================================================
// 5. BOOKINGS TAB
// ============================================================================
export const BookingsTab: React.FC<{
  bookings: Booking[];
  auditLogs: AuditLog[];
}> = ({ bookings, auditLogs }) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBookId, setSelectedBookId] = useState<string>('');

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch = b.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.providerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || b.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const selectedBook = bookings.find((b) => b.id === selectedBookId) || filteredBookings[0];
  const selectedBookLogs = selectedBook ? auditLogs.filter((log) => log.entityId === selectedBook.id) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Coluna Esquerda: Listagem */}
      <div className="lg:col-span-1 space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Monitor de Aulas</h3>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 text-xs"
              placeholder="Pesquisar por Aluno, CFC, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setSelectedBookId('');
            }}
            options={[
              { value: 'ALL', label: `Todos os Status (${bookings.length})` },
              { value: 'CONFIRMED', label: 'Confirmadas' },
              { value: 'IN_PROGRESS', label: 'Em Andamento' },
              { value: 'COMPLETED', label: 'Concluídas' },
              { value: 'PENDING_PAYMENT', label: 'Pagamento Pendente' },
              { value: 'DISPUTED', label: 'Em Disputa' },
              { value: 'CANCELLED_BY_STUDENT', label: 'Cancelado Aluno' },
              { value: 'CANCELLED_BY_PROVIDER', label: 'Cancelado Prestador' },
              { value: 'NO_SHOW_STUDENT', label: 'Falta do Aluno' },
              { value: 'NO_SHOW_PROVIDER', label: 'Falta do Instrutor' },
            ]}
          />
        </div>

        <div className="space-y-2 max-h-[450px] overflow-y-auto">
          {filteredBookings.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50">
              Nenhuma reserva encontrada.
            </div>
          ) : (
            filteredBookings.map((b) => {
              const isSelected = b.id === selectedBook?.id;
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBookId(b.id)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer text-xs ${
                    isSelected ? 'bg-slate-950 text-white border-slate-900 shadow-md' : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-extrabold">{b.id}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="font-medium mt-1">Aluno: {b.studentName}</p>
                  <p className="opacity-80">Parceiro: {b.providerName}</p>
                  <p className="text-[10px] opacity-60 mt-1">{b.scheduledDate} • {b.startTime} - {b.endTime}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Coluna Direita: Ficha de Detalhes */}
      <div className="lg:col-span-2 space-y-6">
        {selectedBook ? (
          <div className="space-y-6 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">Reserva {selectedBook.id}</h3>
                  <p className="text-[11px] text-slate-500">Agendada em: <strong>{selectedBook.scheduledDate} das {selectedBook.startTime} às {selectedBook.endTime}</strong></p>
                </div>
                <StatusBadge status={selectedBook.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-[11px] text-slate-600 mt-3 pt-2 border-t border-dashed border-slate-100">
                <p>Aluno: <strong className="text-slate-900">{selectedBook.studentName}</strong></p>
                <p>CFC / Instrutor: <strong className="text-slate-900">{selectedBook.providerName}</strong> ({selectedBook.instructorName || 'Autônomo'})</p>
                <p>Veículo: <strong className="text-slate-900">{selectedBook.vehicleName || 'Não especificado'}</strong></p>
                <p>Ponto de Encontro: <strong className="text-slate-900">{selectedBook.meetingPoint}</strong></p>
                <p>Transmissão: <strong>{selectedBook.snapshot?.transmission || 'N/A'}</strong></p>
                <p>Duração da Aula: <strong>{selectedBook.snapshot?.durationMinutes || 50} minutos</strong></p>
              </div>
            </div>

            {/* Demonstrativo Financeiro Simulado da Aula */}
            <div className="p-4 border rounded-2xl bg-slate-50 space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalhamento Financeiro (Simulado)</h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor Líquido do Prestador:</span>
                  <span className="font-medium font-mono">{formatCentsToBRL(selectedBook.priceInCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxa da Plataforma (10%):</span>
                  <span className="font-medium font-mono text-amber-700">+{formatCentsToBRL(selectedBook.platformFeeInCents)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                  <span className="text-slate-900">Total Pago pelo Aluno:</span>
                  <span className="font-mono text-slate-950">{formatCentsToBRL(selectedBook.totalInCents)}</span>
                </div>
              </div>
            </div>

            {/* Gestão de Disputas & Reatribuição */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase">Intervenções Administrativas</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Operações operacionais em conformidade com as regras de resguardo de agendamento.
                </p>
              </div>

              {/* Políticas Pendentes */}
              <div className="space-y-2">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                    <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                    Reatribuição de Recursos (BOOKING_RESOURCE_REASSIGNMENT_POLICY_PENDING)
                  </div>
                  <p className="text-[11px] text-amber-800 leading-normal">
                    Alerta do Sistema: Reatribuição automática de instrutor ou veículo para aulas ativas ainda não é suportada diretamente pelo painel administrativo para evitar quebras de agendamento do aluno.
                  </p>
                </div>

                {selectedBook.status === 'DISPUTED' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-950 text-xs">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      Disputa Aberta (DISPUTE_MANAGEMENT_FLOW_PENDING)
                    </div>
                    <p className="text-[11px] text-rose-800 leading-normal">
                      Esta aula foi contestada por uma das partes (Aluno/Instrutor). O fluxo de resolução de disputas regulatório está sob andamento pendente de auditoria de check-in.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de Auditoria */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico de Eventos da Reserva ({selectedBookLogs.length})</h4>
              {selectedBookLogs.length === 0 ? (
                <p className="text-[11px] text-slate-400">Nenhum evento registrado especificamente para esta reserva.</p>
              ) : (
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                  {selectedBookLogs.map((log) => (
                    <div key={log.id} className="p-2 bg-slate-50 rounded border text-[11px] flex justify-between gap-2">
                      <div>
                        <span className="font-extrabold">{log.action}</span>
                        <p className="text-slate-500">Por {log.actorName}</p>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-3xl">
            Selecione uma reserva no monitor ao lado para inspecionar os detalhes operacionais.
          </div>
        )}
      </div>
    </div>
  );
};


// ============================================================================
// 6. FINANCIAL TAB
// ============================================================================
export const FinancialTab: React.FC<{
  bookings: Booking[];
  auditLogs: AuditLog[];
  actor: AuthContext;
  onProcessRefund: (booking: Booking) => void;
}> = ({ bookings, auditLogs, actor, onProcessRefund }) => {
  const [activeSubTab, setActiveSubTab] = useState<'payouts' | 'ledger'>('ledger');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');

  // Computes ledger
  const transactions = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'REFUNDED');

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  const handleRefund = (b: Booking) => {
    onProcessRefund(b);
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Módulo Financeiro & Repasses</h2>
          <p className="text-xs text-slate-500 font-medium">
            Monitoramento de repasses (payouts), ledger de transações e ferramentas de estorno controlado.
          </p>
        </div>
        
        {/* Toggle interno */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-bold border border-slate-200">
          <ButtonBase
            onClick={() => setActiveSubTab('ledger')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${activeSubTab === 'ledger' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Ledger de Transações
          </ButtonBase>
          <ButtonBase
            onClick={() => setActiveSubTab('payouts')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${activeSubTab === 'payouts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            Repasses (Payouts)
          </ButtonBase>
        </div>
      </div>

      {activeSubTab === 'ledger' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Listagem ledger */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico de Transações</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="p-3">Ref Aula</th>
                    <th className="p-3">Aluno</th>
                    <th className="p-3">Prestador</th>
                    <th className="p-3">Valor Líquido</th>
                    <th className="p-3">Taxa (10%)</th>
                    <th className="p-3">Total Transacionado</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedBookingId(t.id)}
                      className={`cursor-pointer transition hover:bg-slate-50/50 ${selectedBookingId === t.id ? 'bg-indigo-50/40 font-semibold' : ''}`}
                    >
                      <td className="p-3 font-mono font-bold text-indigo-600">{t.id}</td>
                      <td className="p-3">{t.studentName}</td>
                      <td className="p-3 font-medium">{t.providerName}</td>
                      <td className="p-3 font-mono">{formatCentsToBRL(t.priceInCents)}</td>
                      <td className="p-3 font-mono text-slate-500">+{formatCentsToBRL(t.platformFeeInCents)}</td>
                      <td className="p-3 font-mono font-bold">{formatCentsToBRL(t.totalInCents)}</td>
                      <td className="p-3">
                        <StatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ficha Refund */}
          <div className="lg:col-span-1 space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ferramenta de Estornos</h4>
            {selectedBooking ? (
              <div className="p-4 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-sm text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">AULA SELECIONADA</span>
                  <h5 className="font-extrabold text-sm text-slate-900">{selectedBooking.id}</h5>
                  <p className="text-slate-500 mt-1">Parceiro: {selectedBooking.providerName}</p>
                  <p className="text-slate-500">Total Transacionado: <strong className="font-mono text-slate-950">{formatCentsToBRL(selectedBooking.totalInCents)}</strong></p>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 leading-relaxed font-medium">
                  <strong>⚠️ Ação Sob Homologação de Ambiente</strong>
                  <p className="mt-1">
                    Esta ferramenta é simulada (DEVELOPMENT) e reverte as transações financeiras nos registros locais.
                  </p>
                </div>

                {selectedBooking.status === 'REFUNDED' ? (
                  <span className="text-emerald-600 font-extrabold block text-center py-2">✓ Transação já estornada / reembolsada.</span>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    onClick={() => handleRefund(selectedBooking)}
                  >
                    Estornar Transação (Refund)
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-3xl bg-slate-50">
                Selecione uma transação ao lado para operar estorno.
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'payouts' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
            <div>
              <span className="font-bold">Política de Retenção de Repasse Seguro (Payout Safety Period)</span>
              <p className="mt-0.5 text-indigo-800">
                Por questões de governança operacional e política contra chargebacks de alunos, os fundos de aulas concluídas permanecem sob status <strong className="bg-indigo-100 px-1 rounded font-mono text-[11px]">HELD</strong> por 24 horas antes de serem liberados para <strong className="bg-indigo-100 px-1 rounded font-mono text-[11px]">AVAILABLE</strong> para o prestador.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="p-3">Ref Parceiro</th>
                  <th className="p-3">Razão Social / Nome</th>
                  <th className="p-3">Valor Pendente (HELD)</th>
                  <th className="p-3">Valor Disponível (AVAILABLE)</th>
                  <th className="p-3">Último Repasse (PAID)</th>
                  <th className="p-3">Status de Processamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.filter(b => b.status === 'COMPLETED').map((b, i) => (
                  <tr key={i}>
                    <td className="p-3 font-mono font-bold text-slate-600">{b.providerId}</td>
                    <td className="p-3">{b.providerName}</td>
                    <td className="p-3 font-mono text-slate-500">{formatCentsToBRL(b.priceInCents)}</td>
                    <td className="p-3 font-mono text-emerald-600 font-bold">{formatCentsToBRL(0)}</td>
                    <td className="p-3 font-mono text-slate-400">---</td>
                    <td className="p-3">
                      <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase">
                        HELD (Safety Period)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================================================
// 7. USERS TAB
// ============================================================================
export const UsersTab: React.FC<{
  users: User[];
  actor: AuthContext;
  onChangeRole: (userId: string, newRole: UserRole) => void;
}> = ({ users, actor, onChangeRole }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    try {
      onChangeRole(userId, newRole);
      // Update selected user local view
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, role: newRole });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Esquerda: Lista de Usuários */}
      <div className="lg:col-span-1 space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Diretório de Usuários ({users.length})</h3>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 text-xs"
              placeholder="Pesquisar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 max-h-[450px] overflow-y-auto">
          {filteredUsers.map((u) => {
            const isSelected = selectedUser?.id === u.id;
            return (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`p-3 rounded-2xl border transition cursor-pointer text-xs flex justify-between items-center ${
                  isSelected ? 'bg-slate-950 text-white border-slate-900 shadow-md' : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <h5 className="font-bold">{u.name}</h5>
                  <p className="opacity-80 mt-0.5">{u.email}</p>
                </div>
                <Badge variant={u.role === 'PLATFORM_ADMIN' ? 'success' : u.role === 'SUPPORT' ? 'warning' : 'neutral'} size="xs" className="uppercase font-bold tracking-wider">
                  {u.role}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Direita: Moderação e Atribuição de Papéis */}
      <div className="lg:col-span-2 space-y-6">
        {selectedUser ? (
          <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">{selectedUser.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ID do Usuário: {selectedUser.id}</p>
              <div className="text-[11px] text-slate-600 space-y-1 mt-2.5">
                <p>E-mail da Conta: <strong>{selectedUser.email}</strong></p>
                <p>Telefone: <strong>{selectedUser.phone}</strong></p>
                <p>Data do Cadastro: <strong>{new Date(selectedUser.createdAt).toLocaleDateString()}</strong></p>
              </div>
            </div>

            {/* Atribuição de Papel */}
            <div className="space-y-4">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  Gerenciamento de Credencial de Acesso (Papel / Roles)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Operação crítica restrita a administradores ativos. SUPPORT está estritamente bloqueado de alterar papéis.
                </p>
              </div>

              {/* Se for SUPPORT, exibe bloqueio */}
              {!actor.roles.includes('PLATFORM_ADMIN') ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 leading-relaxed font-medium">
                  <strong>Acesso Negado (Least Privilege)</strong>
                  <p className="mt-1">
                    Seu perfil ativo de operador (<code className="font-bold">SUPPORT</code>) não possui privilégios para promover usuários, alterar privilégios regulatórios de credenciamento ou ver senhas.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="text-[10px] font-bold text-slate-700 uppercase block">Selecionar Novo Papel (Role)</label>
                  <div className="flex flex-wrap gap-2">
                    {(['STUDENT', 'INSTRUCTOR', 'SCHOOL_ADMIN', 'SUPPORT', 'PLATFORM_ADMIN'] as UserRole[]).map((roleOption) => {
                      const isCurrent = selectedUser.role === roleOption;
                      return (
                        <ButtonBase
                          key={roleOption}
                          disabled={isCurrent}
                          onClick={() => handleRoleChange(selectedUser.id, roleOption)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition border ${
                            isCurrent
                              ? 'bg-indigo-600 text-white border-indigo-600 cursor-default'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                          }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {roleOption}
                        </ButtonBase>
                      );
                    })}
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-normal">
                    <strong>Regra de Salvaguarda Ativa (LAST_PLATFORM_ADMIN_PROTECTION):</strong>
                    <p className="mt-0.5">
                      O sistema bloqueia transações que eliminem ou rebaixem o último administrador geral remanescente para evitar órfãos regulatórios na governança da plataforma.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-3xl">
            Selecione um usuário no diretório ao lado para moderar privilégios.
          </div>
        )}
      </div>
    </div>
  );
};


// ============================================================================
// 8. AUDIT LOG TAB
// ============================================================================
export const AuditTab: React.FC<{
  auditLogs: AuditLog[];
}> = ({ auditLogs }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Compute available actions for filters
  const uniqueActions = Array.from(new Set(auditLogs.map((log) => log.action)));

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch = log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (log.previousValue && log.previousValue.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (log.newValue && log.newValue.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    const matchesRole = filterRole === 'ALL' || log.actorRole === filterRole;
    return matchesSearch && matchesAction && matchesRole;
  });

  return (
    <div className="space-y-4 text-left">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Trilha de Auditoria Geral (Audit Logs)</h2>
        <p className="text-xs text-slate-500 font-medium">
          Registro imutável das ações administrativas da plataforma. Não é permitida edição, retroação ou exclusão dos registros.
        </p>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 text-xs"
            placeholder="Buscar por ID, Valor, Ator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filtrar por ação"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          options={[
            { value: 'ALL', label: 'Todas as Ações' },
            ...uniqueActions.map((act) => ({ value: act, label: act })),
          ]}
        />
        <Select
          aria-label="Filtrar por perfil de ator"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          options={[
            { value: 'ALL', label: 'Todos os Perfis de Ator' },
            { value: 'PLATFORM_ADMIN', label: 'PLATFORM_ADMIN' },
            { value: 'SUPPORT', label: 'SUPPORT' },
            { value: 'INSTRUCTOR', label: 'INSTRUCTOR' },
          ]}
        />
      </div>

      {/* Listagem Tabela */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
            <tr>
              <th className="p-3">Ref AuditLog</th>
              <th className="p-3">Ator (Perfil)</th>
              <th className="p-3">Ação executada</th>
              <th className="p-3">Entidade (Ref ID)</th>
              <th className="p-3">Valor Anterior ➔ Novo Valor</th>
              <th className="p-3">Data & IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  Nenhum registro de auditoria atende aos filtros de pesquisa.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-mono text-[10px] text-slate-400 font-bold">{log.id}</td>
                  <td className="p-3">
                    <span className="font-extrabold text-slate-900">{log.actorName}</span>
                    <span className="block text-[10px] text-slate-500">{log.actorRole}</span>
                  </td>
                  <td className="p-3">
                    <span className="bg-slate-100 text-slate-800 font-mono text-[10px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wide">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-[11px]">
                    <span className="text-slate-400 font-bold">{log.entityType}: </span>
                    <code className="font-mono bg-indigo-50 text-indigo-800 px-1 rounded text-[10px]">{log.entityId}</code>
                  </td>
                  <td className="p-3 max-w-xs truncate font-mono text-[10px] text-slate-500">
                    {log.previousValue || '---'} ➔ {log.newValue || '---'}
                  </td>
                  <td className="p-3 shrink-0 text-slate-400 text-[10px] font-mono leading-tight">
                    <p>{new Date(log.timestamp).toLocaleString()}</p>
                    <p>{log.ipAddress || '127.0.0.1'}</p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// ============================================================================
// 9. SETTINGS TAB
// ============================================================================
export const SettingsTab: React.FC<{
  config: PlatformConfiguration;
  actor: AuthContext;
  onUpdateConfig: (updates: Partial<PlatformConfiguration>) => void | Promise<void>;
}> = ({ config, actor, onUpdateConfig }) => {
  const isAuthorized = actor.roles.includes('PLATFORM_ADMIN');

  // Input states locally managed
  const [fee, setFee] = useState<number | ''>(config.platformFeeDefaultPercentage);
  const [horizon, setHorizon] = useState<number | ''>(config.availabilityHorizonDays);
  const [quoteExp, setQuoteExp] = useState<number | ''>(config.quoteExpirationMinutes);
  const [minNotice, setMinNotice] = useState<number | ''>(config.minimumBookingNoticeHours);
  const [safetyPeriod, setSafetyPeriod] = useState<number | ''>(config.payoutSafetyPeriodHours);
  const [radius, setRadius] = useState<number | ''>(config.searchRadiusDefaultsKm);

  const handleSave = () => {
    if (!isAuthorized) return;
    if ([fee, horizon, quoteExp, minNotice, safetyPeriod, radius].some((value) => value === '')) return;
    onUpdateConfig({
      platformFeeDefaultPercentage: fee,
      availabilityHorizonDays: horizon,
      quoteExpirationMinutes: quoteExp,
      minimumBookingNoticeHours: minNotice,
      payoutSafetyPeriodHours: safetyPeriod,
      searchRadiusDefaultsKm: radius,
    });
  };

  return (
    <div className="space-y-6 text-left max-w-2xl">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Configurações Gerais da Plataforma</h2>
        <p className="text-xs text-slate-500 font-medium">
          Parâmetros regulatórios de preço, prazos, faturamento e buscas globais do ecossistema.
        </p>
      </div>

      {!isAuthorized && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 leading-relaxed font-medium">
          <strong>⚠️ Acesso Restrito (Configurações Bloqueadas)</strong>
          <p className="mt-1">
            Seu perfil ativo de operador (<code className="font-bold">SUPPORT</code>) não possui permissão regulatória para alterar estes parâmetros comerciais. Os formulários abaixo foram travados como somente leitura.
          </p>
        </div>
      )}

      <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block uppercase">Taxa de Serviço da Plataforma (%)</label>
            <Input
              type="number"
              value={fee}
              onChange={(e) => setFee(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!isAuthorized}
              className="text-xs"
            />
            <span className="text-[10px] text-slate-400 block">Percentual recolhido por agendamento de aula prêmio.</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block uppercase">Horizonte de Disponibilidade (Dias)</label>
            <Input
              type="number"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!isAuthorized}
              className="text-xs"
            />
            <span className="text-[10px] text-slate-400 block">Prazo máximo para oferta de agenda comercial (Ex: 30 dias).</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block uppercase">Expiração de Cotação de Aula (Minutos)</label>
            <Input
              type="number"
              value={quoteExp}
              onChange={(e) => setQuoteExp(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!isAuthorized}
              className="text-xs"
            />
            <span className="text-[10px] text-slate-400 block">Tempo limite para realizar o PIX/cartão antes do bloqueio expirar.</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block uppercase">Aviso Prévio Mínimo de Aula (Horas)</label>
            <Input
              type="number"
              value={minNotice}
              onChange={(e) => setMinNotice(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!isAuthorized}
              className="text-xs"
            />
            <span className="text-[10px] text-slate-400 block">Tempo necessário antes do início para permitir novos bookings.</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block uppercase">Retenção de Payout Seguro (Horas)</label>
            <Input
              type="number"
              value={safetyPeriod}
              onChange={(e) => setSafetyPeriod(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!isAuthorized}
              className="text-xs"
            />
            <span className="text-[10px] text-slate-400 block">Prazo de segurança contra estorno após a aula concluída.</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block uppercase">Raio Padrão de Busca Próxima (Km)</label>
            <Input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!isAuthorized}
              className="text-xs"
            />
            <span className="text-[10px] text-slate-400 block">Distância padrão para filtros geolocalizados de aluno.</span>
          </div>
        </div>

        {isAuthorized && (
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Settings className="w-4 h-4" />}
              onClick={handleSave}
            >
              Salvar Parâmetros Globais
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1 leading-normal">
        <p className="font-bold text-slate-900 flex items-center gap-1">
          <History className="w-3.5 h-3.5 text-indigo-600" />
          Auditoria de Alteração de Parâmetro
        </p>
        <p>
          Qualquer modificação nestes parâmetros gera instantaneamente uma trilha de auditoria contendo o valor antigo, o novo valor, a identificação do administrador responsável, carimbo de data e IP de acesso.
        </p>
        <p className="text-[10px] pt-1 border-t border-dashed mt-2 text-slate-400">
          Última alteração: {new Date(config.updatedAt).toLocaleString()} por {config.updatedBy || 'system'}
        </p>
      </div>
    </div>
  );
};
