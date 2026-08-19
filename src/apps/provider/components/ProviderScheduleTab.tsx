import React from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Clock,
  Ban,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  AvailabilityRule,
  AvailabilityException,
  ServiceOffering,
  Vehicle,
  DayOfWeek,
  ExceptionType,
  ExceptionReasonCategory,
} from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DAY_OF_WEEK_LABELS_PT, generateAvailableSlots } from '../../../domain/availability';

interface ProviderScheduleTabProps {
  scheduleSubTab: 'rules' | 'exceptions' | 'simulator';
  onSubTabChange: (tab: 'rules' | 'exceptions' | 'simulator') => void;
  availabilityRules: AvailabilityRule[];
  availabilityExceptions: AvailabilityException[];
  offerings: ServiceOffering[];
  vehicles: Vehicle[];
  isAddRuleModalOpen: boolean;
  onOpenAddRuleModal: () => void;
  onCloseAddRuleModal: () => void;
  ruleForm: { dayOfWeek: DayOfWeek; startTime: string; endTime: string };
  onRuleFormChange: (form: { dayOfWeek: DayOfWeek; startTime: string; endTime: string }) => void;
  onSaveRule: () => void;
  onDeleteRule: (id: string) => void;
  ruleError: string | null;
  isAddExceptionModalOpen: boolean;
  onOpenAddExceptionModal: () => void;
  onCloseAddExceptionModal: () => void;
  exceptionForm: {
    type: ExceptionType;
    reasonCategory: ExceptionReasonCategory;
    reason: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    vehicleId: string;
  };
  onExceptionFormChange: (form: any) => void;
  onSaveException: () => void;
  onDeleteException: (id: string) => void;
  exceptionError: string | null;
  simOfferingId: string;
  onSimOfferingIdChange: (id: string) => void;
  simDate: string;
  onSimDateChange: (date: string) => void;
}

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Segunda-feira' },
  { value: 'TUESDAY', label: 'Terça-feira' },
  { value: 'WEDNESDAY', label: 'Quarta-feira' },
  { value: 'THURSDAY', label: 'Quinta-feira' },
  { value: 'FRIDAY', label: 'Sexta-feira' },
  { value: 'SATURDAY', label: 'Sábado' },
  { value: 'SUNDAY', label: 'Domingo' },
];

export const ProviderScheduleTab: React.FC<ProviderScheduleTabProps> = ({
  scheduleSubTab,
  onSubTabChange,
  availabilityRules,
  availabilityExceptions,
  offerings,
  vehicles,
  isAddRuleModalOpen,
  onOpenAddRuleModal,
  onCloseAddRuleModal,
  ruleForm,
  onRuleFormChange,
  onSaveRule,
  onDeleteRule,
  ruleError,
  isAddExceptionModalOpen,
  onOpenAddExceptionModal,
  onCloseAddExceptionModal,
  exceptionForm,
  onExceptionFormChange,
  onSaveException,
  onDeleteException,
  exceptionError,
  simOfferingId,
  onSimOfferingIdChange,
  simDate,
  onSimDateChange,
}) => {
  // Simulator calculation
  const selectedSimOffering = offerings.find((o) => o.id === simOfferingId);
  const simulatedSlots = selectedSimOffering && simDate ? generateAvailableSlots({
    provider: { id: selectedSimOffering.providerId, status: 'ACTIVE' } as any,
    offering: selectedSimOffering,
    vehicles,
    startDate: simDate,
    endDate: simDate,
    availabilityRules,
    exceptions: availabilityExceptions,
    existingBookings: [],
  }) : [];

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="mazzi-eyebrow mb-1">Disponibilidade</p>
          <h2 className="mazzi-title">Agenda & Horários</h2>
        </div>

        <div className="flex items-center gap-2">
          {scheduleSubTab === 'rules' && (
            <Button variant="primary" size="sm" onClick={onOpenAddRuleModal} leftIcon={<Plus className="w-4 h-4" />}>
              Nova Regra Semanal
            </Button>
          )}
          {scheduleSubTab === 'exceptions' && (
            <Button variant="primary" size="sm" onClick={onOpenAddExceptionModal} leftIcon={<Plus className="w-4 h-4" />}>
              Novo Bloqueio / Exceção
            </Button>
          )}
        </div>
      </div>

      {/* Subtabs Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-[#e9e6de] shadow-xs">
        <button
          type="button"
          onClick={() => onSubTabChange('rules')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition ${
            scheduleSubTab === 'rules' ? 'bg-[#202126] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Horários Recorrentes ({availabilityRules.length})
        </button>
        <button
          type="button"
          onClick={() => onSubTabChange('exceptions')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition ${
            scheduleSubTab === 'exceptions' ? 'bg-[#202126] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Bloqueios ({availabilityExceptions.length})
        </button>
        <button
          type="button"
          onClick={() => onSubTabChange('simulator')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition ${
            scheduleSubTab === 'simulator' ? 'bg-[#202126] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Simulador
        </button>
      </div>

      {/* RECURRING RULES SUBTAB */}
      {scheduleSubTab === 'rules' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              As <strong>Regras Semanais</strong> definem os horários em que você costuma estar disponível para dar aulas. O motor de busca da MAZZI gera os slots automaticamente a partir dessas janelas.
            </p>
          </div>

          {availabilityRules.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon className="w-8 h-8 text-slate-400" />}
              title="Nenhuma regra semanal cadastrada"
              description="Cadastre seus dias e horários de trabalho para liberar vagas aos alunos."
              actionLabel="Cadastrar Primeira Regra"
              onAction={onOpenAddRuleModal}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availabilityRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 rounded-2xl bg-white border border-[#e9e6de] shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {DAY_OF_WEEK_LABELS_PT[rule.dayOfWeek]}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Ativa
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-[#202126] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {rule.startTime} até {rule.endTime} (América/São Paulo)
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRule(rule.id)}
                    className="text-rose-600 hover:bg-rose-50"
                    aria-label="Excluir regra"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EXCEPTIONS & BLOCKS SUBTAB */}
      {scheduleSubTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
            <Ban className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
            <p>
              Os <strong>Bloqueios e Exceções</strong> têm precedência total sobre as regras semanais. Use para registrar folgas, feriados ou indisponibilidade de veículo.
            </p>
          </div>

          {availabilityExceptions.length === 0 ? (
            <EmptyState
              icon={<Ban className="w-8 h-8 text-slate-400" />}
              title="Nenhum bloqueio cadastrado"
              description="Sua agenda não possui folgas ou bloqueios administrativos programados."
              actionLabel="Cadastrar Bloqueio"
              onAction={onOpenAddExceptionModal}
            />
          ) : (
            <div className="space-y-3">
              {availabilityExceptions.map((exc) => (
                <div
                  key={exc.id}
                  className="p-4 rounded-2xl bg-white border border-[#e9e6de] shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={exc.type === 'BLOCK' ? 'danger' : 'success'}>
                        {exc.type === 'BLOCK' ? 'Bloqueio Total' : 'Exceção Aberta'}
                      </Badge>
                      <span className="text-xs font-extrabold text-slate-900">{exc.reason}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      De: {new Date(exc.startAt).toLocaleString('pt-BR')} até {new Date(exc.endAt).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteException(exc.id)}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SIMULATOR SUBTAB */}
      {scheduleSubTab === 'simulator' && (
        <div className="p-5 rounded-3xl bg-white border border-[#e9e6de] shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
            <Sparkles className="w-4 h-4 text-[#f6c945]" />
            <span>Simulador do Gerador de Vagas</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-700 block mb-1">Selecione a Oferta</label>
              <Select
                value={simOfferingId}
                onChange={(e) => onSimOfferingIdChange(e.target.value)}
                options={[
                  { value: '', label: 'Selecione uma oferta...' },
                  ...offerings.map((o) => ({ value: o.id, label: `${o.category} - ${o.durationMinutes} min (R$ ${(o.priceInCents / 100).toFixed(2)})` })),
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-700 block mb-1">Selecione a Data</label>
              <Input
                type="date"
                value={simDate}
                onChange={(e) => onSimDateChange(e.target.value)}
              />
            </div>
          </div>

          {selectedSimOffering && simDate && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Vagas Geradas ({simulatedSlots.length}):
              </h4>

              {simulatedSlots.length === 0 ? (
                <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
                  Nenhuma vaga gerada para esta data. Verifique se existe regra semanal para o dia da semana ou se há bloqueio ativo.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {simulatedSlots.map((slot, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono text-xs font-bold shadow-xs"
                    >
                      {slot.startTime} - {slot.endTime}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ADD RECURRING RULE MODAL */}
      <Modal isOpen={isAddRuleModalOpen} onClose={onCloseAddRuleModal} title="Cadastrar Regra Semanal">
        <div className="space-y-4 text-left">
          {ruleError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{ruleError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-extrabold text-slate-900 block mb-1">Dia da Semana *</label>
            <Select
              value={ruleForm.dayOfWeek}
              onChange={(e) => onRuleFormChange({ ...ruleForm, dayOfWeek: e.target.value as DayOfWeek })}
              options={DAY_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Horário Inicial *</label>
              <Input
                type="time"
                value={ruleForm.startTime}
                onChange={(e) => onRuleFormChange({ ...ruleForm, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Horário Final *</label>
              <Input
                type="time"
                value={ruleForm.endTime}
                onChange={(e) => onRuleFormChange({ ...ruleForm, endTime: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="secondary" size="sm" onClick={onCloseAddRuleModal}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={onSaveRule}>
              Salvar Regra
            </Button>
          </div>
        </div>
      </Modal>

      {/* ADD EXCEPTION MODAL */}
      <Modal isOpen={isAddExceptionModalOpen} onClose={onCloseAddExceptionModal} title="Cadastrar Bloqueio / Exceção">
        <div className="space-y-4 text-left">
          {exceptionError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{exceptionError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-extrabold text-slate-900 block mb-1">Motivo do Bloqueio *</label>
            <Input
              value={exceptionForm.reason}
              onChange={(e) => onExceptionFormChange({ ...exceptionForm, reason: e.target.value })}
              placeholder="Ex: Manutenção do veículo, Folga médica, Feriado"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Data Início *</label>
              <Input
                type="date"
                value={exceptionForm.startDate}
                onChange={(e) => onExceptionFormChange({ ...exceptionForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Data Fim *</label>
              <Input
                type="date"
                value={exceptionForm.endDate}
                onChange={(e) => onExceptionFormChange({ ...exceptionForm, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="secondary" size="sm" onClick={onCloseAddExceptionModal}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={onSaveException}>
              Salvar Bloqueio
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
