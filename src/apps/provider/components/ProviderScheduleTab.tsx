import React from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Clock, Clock3, Ban, CheckCircle2, AlertCircle, Sliders, Sparkles, Info, Pencil, X, } from 'lucide-react';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';
import { getTodayInSaoPaulo, getBusinessDateFromTimestamp, getTimeInSaoPaulo, formatDateTimeBR } from '../../../lib/date-format';
import {
  AvailabilityRule, AvailabilityException, ServiceOffering, Vehicle, DayOfWeek, ExceptionType, ExceptionReasonCategory, } from '../../../types';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { DateInput, TimeInput } from '../../../components/ui/DateTimeInput';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DAY_OF_WEEK_LABELS_PT, generateAvailableSlots } from '../../../domain/availability';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { DateTimeSlotPicker } from '../../../components/schedule/DateTimeSlotPicker';
import { generateEmergencyBlockableSlots, isEmergencyBlockDurationAvailable, EmergencyBlockableSlot } from '../../../domain/emergency-block';

interface ProviderScheduleTabProps {
  scheduleSubTab: 'rules' | 'exceptions' | 'simulator';
  onSubTabChange: (tab: 'rules' | 'exceptions' | 'simulator') => void;
  availabilityRules: AvailabilityRule[];
  availabilityExceptions: AvailabilityException[];
  offerings: ServiceOffering[];
  vehicles: Vehicle[];
  isAddRuleModalOpen: boolean;
  onOpenAddRuleModal: () => void;
  onOpenEditRule: (rule: AvailabilityRule) => void;
  onCloseAddRuleModal: () => void;
  ruleForm: { dayOfWeek: DayOfWeek; startTime: string; endTime: string };
  onRuleFormChange: (form: { dayOfWeek: DayOfWeek; startTime: string; endTime: string }) => void;
  onSaveRule: () => void;
  editingRuleId: string | null;
  isSavingRule: boolean;
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
  instructorGlobalBlocks?: any[];
  onSaveGlobalBlock?: (startAt: string, endAt: string, reason?: string, blockId?: string) => Promise<void>;
  onDeleteGlobalBlock?: (blockId: string) => Promise<void>;
  onSaveEmergencyBlock?: (startAt: string, endAt: string, reason?: string) => Promise<void>;
  isInstructorUser?: boolean;
  bookings?: any[];
  calendarLoadError?: string | null;
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
  onOpenEditRule,
  onCloseAddRuleModal,
  ruleForm,
  onRuleFormChange,
  onSaveRule,
  editingRuleId,
  isSavingRule,
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
  instructorGlobalBlocks,
  onSaveGlobalBlock,
  onDeleteGlobalBlock,
  onSaveEmergencyBlock,
  isInstructorUser,
  bookings = [],
  calendarLoadError,
}) => {
  // Dedicated state for Global Personal Blocks
  const [isAddGlobalBlockModalOpen, setIsAddGlobalBlockModalOpen] = React.useState(false);
  const [editingGlobalBlockId, setEditingGlobalBlockId] = React.useState<string | null>(null);
  const [globalBlockForm, setGlobalBlockForm] = React.useState({
    startDate: '',
    startTime: '08:00',
    endDate: '',
    endTime: '18:00',
    reason: '',
  });
  const [globalBlockError, setGlobalBlockError] = React.useState<string | null>(null);
  const [globalBlockActionError, setGlobalBlockActionError] = React.useState<string | null>(null);
  const [isSavingGlobalBlock, setIsSavingGlobalBlock] = React.useState(false);
  const [deletingGlobalBlockId, setDeletingGlobalBlockId] = React.useState<string | null>(null);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = React.useState(false);
  const [isSavingEmergencyBlock, setIsSavingEmergencyBlock] = React.useState(false);
  const [emergencyBlockError, setEmergencyBlockError] = React.useState<string | null>(null);
  const [emergencySelectedDate, setEmergencySelectedDate] = React.useState('');
  const [emergencySelectedSlots, setEmergencySelectedSlots] = React.useState<EmergencyBlockableSlot[]>([]);

  const openEmergencyBlockModal = () => {
    const firstDate = Object.keys(emergencySlotsByDate).sort()[0] || getTodayInSaoPaulo();
    setEmergencySelectedDate(firstDate);
    setEmergencySelectedSlots([]);
    setEmergencyReason('');
    setEmergencyBlockError(null);
    setIsEmergencyModalOpen(true);
  };

  const saveEmergencyBlock = async () => {
    if (!onSaveEmergencyBlock || isSavingEmergencyBlock) return;
    setEmergencyBlockError(null);
    if (!emergencySelectedSlots.length) {
      setEmergencyBlockError('Selecione pelo menos uma hora livre.');
      return;
    }
    setIsSavingEmergencyBlock(true);
    try {
      await onSaveEmergencyBlock(
        emergencySelectedSlots[0].startAt,
        emergencySelectedSlots[emergencySelectedSlots.length - 1].endAt,
        emergencyReason.trim() || undefined,
      );
      setIsEmergencyModalOpen(false);
    } catch (error: any) {
      setEmergencyBlockError(mapFriendlyErrorMessage(error, 'Este horário já possui uma aula ou reserva ativa. O bloqueio não foi realizado.'));
    } finally {
      setIsSavingEmergencyBlock(false);
    }
  };

  const [emergencyReason, setEmergencyReason] = React.useState('');
  const emergencySlotsByDate = React.useMemo(() => {
    if (calendarLoadError) return {};
    const result: Record<string, EmergencyBlockableSlot[]> = {};
    const base = new Date(`${getTodayInSaoPaulo()}T12:00:00-03:00`);
    for (let index = 0; index < 30; index += 1) {
      const date = new Date(base); date.setDate(base.getDate() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      result[key] = generateEmergencyBlockableSlots({ date: key, rules: availabilityRules, bookings, globalBlocks: instructorGlobalBlocks || [], exceptions: availabilityExceptions });
    }
    return result;
  }, [availabilityRules, bookings, instructorGlobalBlocks, availabilityExceptions, calendarLoadError]);

  const handleOpenCreateGlobalBlock = () => {
    setEditingGlobalBlockId(null);
    const todaySp = getTodayInSaoPaulo();
    setGlobalBlockForm({
      startDate: todaySp,
      startTime: '08:00',
      endDate: todaySp,
      endTime: '18:00',
      reason: '',
    });
    setGlobalBlockError(null);
    setIsAddGlobalBlockModalOpen(true);
  };

  const handleOpenEditGlobalBlock = (gb: any) => {
    setEditingGlobalBlockId(gb.id);
    const startDateStr = getBusinessDateFromTimestamp(gb.start_at);
    const startTimeStr = getTimeInSaoPaulo(gb.start_at);
    const endDateStr = getBusinessDateFromTimestamp(gb.end_at);
    const endTimeStr = getTimeInSaoPaulo(gb.end_at);

    setGlobalBlockForm({
      startDate: startDateStr,
      startTime: startTimeStr,
      endDate: endDateStr,
      endTime: endTimeStr,
      reason: gb.reason || '',
    });
    setGlobalBlockError(null);
    setIsAddGlobalBlockModalOpen(true);
  };

  const handleSaveGlobalBlockSubmit = async () => {
    setGlobalBlockError(null);
    if (!globalBlockForm.startDate || !globalBlockForm.startTime || !globalBlockForm.endDate || !globalBlockForm.endTime) {
      setGlobalBlockError('Data inicial, hora inicial, data final e hora final são obrigatórias.');
      return;
    }

    const startIso = `${globalBlockForm.startDate}T${globalBlockForm.startTime}:00.000-03:00`;
    const endIso = `${globalBlockForm.endDate}T${globalBlockForm.endTime}:00.000-03:00`;

    if (new Date(endIso) <= new Date(startIso)) {
      setGlobalBlockError('A data e hora final devem ser posteriores à data e hora inicial.');
      return;
    }

    if (onSaveGlobalBlock) {
      try {
        setIsSavingGlobalBlock(true);
        await onSaveGlobalBlock(startIso, endIso, globalBlockForm.reason.trim() || undefined, editingGlobalBlockId || undefined);
        setIsAddGlobalBlockModalOpen(false);
        setEditingGlobalBlockId(null);
        setGlobalBlockForm({ startDate: '', startTime: '08:00', endDate: '', endTime: '18:00', reason: '' });
      } catch (err: any) {
        setGlobalBlockError(mapFriendlyErrorMessage(err, 'Erro ao salvar bloqueio pessoal global.'));
      } finally {
        setIsSavingGlobalBlock(false);
      }
    }
  };

  const handleDeleteGlobalBlockClick = async (blockId: string) => {
    if (!onDeleteGlobalBlock) return;
    try {
      setDeletingGlobalBlockId(blockId);
      setGlobalBlockActionError(null);
      await onDeleteGlobalBlock(blockId);
    } catch (err: any) {
      setGlobalBlockActionError(mapFriendlyErrorMessage(err, 'Não foi possível excluir o bloqueio pessoal. Tente novamente.'));
    } finally {
      setDeletingGlobalBlockId(null);
    }
  };

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
    instructorGlobalBlocks,
  }) : [];

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <AppPageHeader eyebrow="Sua jornada" title="Agenda & Horários" subtitle="Organize seus horários e disponibilidade." />

      {/* Subtabs Switcher */}
      <div className="mazzi-segmented overflow-x-auto">
        <ButtonBase
          type="button"
          onClick={() => onSubTabChange('rules')}
          aria-selected={scheduleSubTab === 'rules'}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap"
          data-active={scheduleSubTab === 'rules'}
        >
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Horários</span>
        </ButtonBase>
        <ButtonBase
          type="button"
          onClick={() => onSubTabChange('exceptions')}
          aria-selected={scheduleSubTab === 'exceptions'}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap"
          data-active={scheduleSubTab === 'exceptions'}
        >
          <Ban className="w-3.5 h-3.5" />
          <span>Bloqueios</span>
        </ButtonBase>
        <ButtonBase
          type="button"
          onClick={() => onSubTabChange('simulator')}
          aria-selected={scheduleSubTab === 'simulator'}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap"
          data-active={scheduleSubTab === 'simulator'}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Simulador</span>
        </ButtonBase>
      </div>
      <div className="flex justify-end">
        {scheduleSubTab === 'rules' && (
          <div className="flex flex-nowrap justify-end gap-2 overflow-x-auto">
            <Button variant="primary" size="sm" onClick={onOpenAddRuleModal} leftIcon={<Plus className="w-4 h-4" />}>
              Nova Regra Semanal
            </Button>
          </div>
        )}
        {scheduleSubTab === 'exceptions' && (
          <div className="flex flex-nowrap justify-end gap-2 overflow-x-auto">
            {isInstructorUser && onSaveEmergencyBlock && !calendarLoadError && (
              <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" onClick={openEmergencyBlockModal} leftIcon={<Clock3 className="w-4 h-4" />} aria-label="Criar bloqueio rápido de horário">
                Bloqueio rápido
              </Button>
            )}
            <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={onOpenAddExceptionModal} leftIcon={<Plus className="w-4 h-4" />}>
              Novo Bloqueio / Exceção
            </Button>
          </div>
        )}
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
                    <span className="text-sm font-bold text-slate-900">
                        {DAY_OF_WEEK_LABELS_PT[rule.dayOfWeek]}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Ativa
                      </span>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--mazzi-dark)]">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {rule.startTime} até {rule.endTime} (América/São Paulo)
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenEditRule(rule)}
                      className="text-slate-700 hover:bg-slate-100"
                      aria-label={`Editar horário de ${DAY_OF_WEEK_LABELS_PT[rule.dayOfWeek]}`}
                      title="Editar horário"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteRule(rule.id)}
                      className="text-rose-600 hover:bg-rose-50"
                      aria-label={`Excluir horário de ${DAY_OF_WEEK_LABELS_PT[rule.dayOfWeek]}`}
                      title="Excluir horário"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EXCEPTIONS & BLOCKS SUBTAB */}
      {scheduleSubTab === 'exceptions' && (
        <div className="space-y-4">
          {/* INSTRUCTOR GLOBAL PERSONAL BLOCKS SECTION */}
          {isInstructorUser && (
            <div className="space-y-3">
              {globalBlockActionError && (
                <div role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-extrabold text-rose-950 flex items-center justify-between gap-3">
                  <span>{globalBlockActionError}</span>
                  <ButtonBase
                    type="button"
                    onClick={() => setGlobalBlockActionError(null)}
                    className="text-rose-600 hover:text-rose-900 font-bold cursor-pointer"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </ButtonBase>
                </div>
              )}

              {instructorGlobalBlocks && instructorGlobalBlocks.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {instructorGlobalBlocks.map((gb) => (
                    <div
                      key={gb.id}
                      className="rounded-2xl border border-[#e9e6de] bg-white p-4 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div>
                      <p className="text-xs font-bold text-slate-900">
                          {formatDateTimeBR(gb.start_at)} até {formatDateTimeBR(gb.end_at)}
                        </p>
                        {gb.reason && (
                          <p className="text-xs text-slate-600 font-medium mt-0.5">
                            Motivo: {gb.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-600 hover:bg-slate-100"
                          onClick={() => handleOpenEditGlobalBlock(gb)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {onDeleteGlobalBlock && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50"
                            disabled={deletingGlobalBlockId === gb.id}
                            isLoading={deletingGlobalBlockId === gb.id}
                            onClick={() => handleDeleteGlobalBlockClick(gb.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-extrabold text-amber-900/70 italic pt-1">
                  Nenhum bloqueio pessoal global cadastrado.
                </p>
              )}
            </div>
          )}

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
                    <span className="text-xs font-bold text-slate-900">{exc.reason}</span>
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
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
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
              <DateInput
                value={simDate}
                onChange={onSimDateChange}
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
      <Modal isOpen={isAddRuleModalOpen} onClose={onCloseAddRuleModal} title={editingRuleId ? 'Editar Regra Semanal' : 'Cadastrar Regra Semanal'}>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Horário Inicial *</label>
              <TimeInput
                value={ruleForm.startTime}
                onChange={(value) => onRuleFormChange({ ...ruleForm, startTime: value })}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Horário Final *</label>
              <TimeInput
                value={ruleForm.endTime}
                onChange={(value) => onRuleFormChange({ ...ruleForm, endTime: value })}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="dangerSoft" size="sm" onClick={onCloseAddRuleModal} disabled={isSavingRule}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={onSaveRule} isLoading={isSavingRule}>
              {editingRuleId ? 'Salvar Alterações' : 'Salvar Regra'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isEmergencyModalOpen} onClose={() => !isSavingEmergencyBlock && setIsEmergencyModalOpen(false)} title="Bloqueio rápido">
        <div className="space-y-4 text-left">
          <p className="text-xs leading-relaxed text-slate-600">Escolha uma data e um horário realmente livre na sua agenda.</p>
          {emergencyBlockError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{emergencyBlockError}</div>}
          <DateTimeSlotPicker slotsByDate={emergencySlotsByDate} selectedDate={emergencySelectedDate} selectionMode="hour-range" selectedSlots={emergencySelectedSlots} onDateChange={(date) => { setEmergencySelectedDate(date); setEmergencySelectedSlots([]); }} onSlotsChange={setEmergencySelectedSlots} />
          {emergencySelectedSlots.length > 0 && <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700">{emergencySelectedSlots[0].startTime} às {emergencySelectedSlots[emergencySelectedSlots.length - 1].endTime} · {emergencySelectedSlots.length} {emergencySelectedSlots.length === 1 ? 'hora selecionada' : 'horas selecionadas'}</div>}
          <Input label="Motivo (opcional)" placeholder="Ex: emergência pessoal, problema com veículo..." value={emergencyReason} onChange={(event) => setEmergencyReason(event.target.value)} />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="dangerSoft" size="sm" onClick={() => setIsEmergencyModalOpen(false)} disabled={isSavingEmergencyBlock}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={saveEmergencyBlock} isLoading={isSavingEmergencyBlock}>Bloquear horário</Button>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Data Início *</label>
              <DateInput
                value={exceptionForm.startDate}
                onChange={(value) => onExceptionFormChange({ ...exceptionForm, startDate: value })}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Data Fim *</label>
              <DateInput
                value={exceptionForm.endDate}
                onChange={(value) => onExceptionFormChange({ ...exceptionForm, endDate: value })}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="dangerSoft" size="sm" onClick={onCloseAddExceptionModal}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={onSaveException}>
              Salvar Bloqueio
            </Button>
          </div>
        </div>
      </Modal>

      {/* DEDICATED INSTRUCTOR GLOBAL PERSONAL BLOCK MODAL */}
      <Modal
        isOpen={isAddGlobalBlockModalOpen}
        onClose={() => {
          if (!isSavingGlobalBlock) {
            setIsAddGlobalBlockModalOpen(false);
            setEditingGlobalBlockId(null);
          }
        }}
        title={editingGlobalBlockId ? 'Editar Bloqueio Pessoal Global' : 'Cadastrar Bloqueio Pessoal Global'}
      >
        <div className="space-y-4 text-left">
          {globalBlockError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{globalBlockError}</span>
            </div>
          )}

          <p className="text-xs text-slate-600">
            Este bloqueio ficará ativo para a sua identidade física como instrutor e impedirá agendamentos particulares e de qualquer autoescola.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Data Início *</label>
              <DateInput
                value={globalBlockForm.startDate}
                onChange={(value) => setGlobalBlockForm({ ...globalBlockForm, startDate: value })}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Hora Início *</label>
              <TimeInput
                value={globalBlockForm.startTime}
                onChange={(value) => setGlobalBlockForm({ ...globalBlockForm, startTime: value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Data Fim *</label>
              <DateInput
                value={globalBlockForm.endDate}
                onChange={(value) => setGlobalBlockForm({ ...globalBlockForm, endDate: value })}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Hora Fim *</label>
              <TimeInput
                value={globalBlockForm.endTime}
                onChange={(value) => setGlobalBlockForm({ ...globalBlockForm, endTime: value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-900 block mb-1">Motivo (Opcional)</label>
            <Input
              value={globalBlockForm.reason}
              onChange={(e) => setGlobalBlockForm({ ...globalBlockForm, reason: e.target.value })}
              placeholder="Ex: Férias, Compromisso pessoal, Exame médico"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button
              variant="dangerSoft"
              size="sm"
              disabled={isSavingGlobalBlock}
              onClick={() => {
                setIsAddGlobalBlockModalOpen(false);
                setEditingGlobalBlockId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSavingGlobalBlock}
              disabled={isSavingGlobalBlock}
              onClick={handleSaveGlobalBlockSubmit}
            >
              {editingGlobalBlockId ? 'Atualizar Bloqueio' : 'Salvar Bloqueio Pessoal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
