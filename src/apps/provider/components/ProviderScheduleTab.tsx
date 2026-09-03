import React from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Clock, Clock3, Ban, PowerOff, CheckCircle2, AlertCircle, Sliders, Sparkles, Info, Pencil, X, Power, } from 'lucide-react';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';
import { getTodayInSaoPaulo, getBusinessDateFromTimestamp, getTimeInSaoPaulo, formatDateTimeBR, getDayBlockDisplayRange } from '../../../lib/date-format';
import {
  AvailabilityRule, AvailabilityException, ServiceOffering, Vehicle, DayOfWeek, ExceptionType, ExceptionReasonCategory, } from '../../../types';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { ModalActionFooter } from '../../../components/ui/ModalActionFooter';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { DateInput, TimeInput } from '../../../components/ui/DateTimeInput';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DAY_OF_WEEK_LABELS_PT, generateAvailableSlots } from '../../../domain/availability';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { ReasonChips } from '../../../components/ui/ReasonChips';
import { DateTimeSlotPicker } from '../../../components/schedule/DateTimeSlotPicker';
import { generateEmergencyBlockableSlots, isEmergencyBlockDurationAvailable, isContiguousHourRange, normalizeContiguousHourRange, EmergencyBlockableSlot } from '../../../domain/emergency-block';

interface ProviderScheduleTabProps {
  scheduleSubTab: 'rules' | 'exceptions';
  onSubTabChange: (tab: 'rules' | 'exceptions') => void;
  hideSubTabs?: boolean;
  hideHeader?: boolean;
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
  onDeleteRule: (id: string) => Promise<void>;
  ruleError: string | null;
  isAddExceptionModalOpen: boolean;
  onOpenAddExceptionModal: () => void;
  onCloseAddExceptionModal: () => void;
  exceptionForm: {
    type: ExceptionType;
    reasonCategory: ExceptionReasonCategory;
    reason: string;
    startDate: string;
    endDate: string;
    vehicleId: string;
  };
  onExceptionFormChange: (form: any) => void;
  onSaveException: () => Promise<void>;
  onDeleteException: (id: string) => Promise<void>;
  onDeactivateException?: (id: string) => Promise<void>;
  onActivateException?: (id: string) => Promise<void>;
  exceptionError: string | null;
  simOfferingId: string;
  onSimOfferingIdChange: (id: string) => void;
  simDate: string;
  onSimDateChange: (date: string) => void;
  instructorGlobalBlocks?: any[];
  onSaveGlobalBlock?: (startAt: string, endAt: string, reason?: string, blockId?: string) => Promise<void>;
  onDeleteGlobalBlock?: (blockId: string) => Promise<void>;
  onSaveEmergencyBlock?: (startAt: string, endAt: string, reason?: string, blockId?: string) => Promise<void>;
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

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const value = `${String(hour).padStart(2, '0')}:00`;
  return { value, label: value };
});

const BLOCK_REASON_OPTIONS: { value: ExceptionReasonCategory; label: string }[] = [
  { value: 'VACATION', label: 'Férias' },
  { value: 'PERSONAL', label: 'Folga / compromisso pessoal' },
  { value: 'MAINTENANCE', label: 'Manutenção do carro' },
  { value: 'HOLIDAY', label: 'Feriado' },
  { value: 'MANUAL_BLOCK', label: 'Indisponibilidade' },
  { value: 'OTHER', label: 'Outro motivo' },
];

const QUICK_BLOCK_REASON_OPTIONS = [
  { value: 'ALMOCO', label: 'Almoço' },
  { value: 'EMERGENCIA_MEDICA', label: 'Emergência médica' },
  { value: 'MOTIVOS_PESSOAIS', label: 'Motivos pessoais' },
  { value: 'OUTRO', label: 'Outro motivo' },
] as const;

interface ScheduleBlockCardItem {
  id: string;
  kind: 'quick' | 'days';
  startAt: string;
  endAt: string;
  reason?: string;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDeactivate?: () => void;
  onActivate?: () => void;
  active?: boolean;
  deleting?: boolean;
  working?: boolean;
}

const ScheduleBlockCard: React.FC<ScheduleBlockCardItem> = ({ id, kind, startAt, endAt, reason, editable, active = true, onEdit, onDelete, onDeactivate, onActivate, deleting, working = false }) => {
  const dayRange = kind === 'days' ? getDayBlockDisplayRange(startAt, endAt) : null;
  return (
  <article id={`schedule-block-${id}`} className={`mazzi-card min-w-0 w-full overflow-hidden p-4 sm:p-5 text-left text-[var(--mazzi-text)] space-y-3.5 ${!active ? 'opacity-75' : ''}`}>
    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
      <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={kind === 'quick' ? 'warning' : 'danger'}>{kind === 'quick' ? 'Bloqueio rápido' : 'Bloqueio de dias'}</Badge>
        {!active && <Badge variant="default" className="!border-slate-300 !bg-slate-100 !text-slate-700">Desativado</Badge>}
      </div>
      {reason && <p className="text-sm font-bold leading-snug text-[var(--mazzi-text)] break-words">{reason}</p>}
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] text-amber-600 border border-amber-200/60">
        {kind === 'quick' ? <Clock3 className="h-5 w-5" aria-hidden="true" /> : <CalendarIcon className="h-5 w-5" aria-hidden="true" />}
      </div>
    </div>
    <div className="space-y-1">
      {dayRange ? (
        <p className="text-sm font-extrabold leading-tight text-[var(--mazzi-text)] break-words">
          {dayRange.startDate}{dayRange.startDate !== dayRange.endDate ? ` a ${dayRange.endDate}` : ''} — {dayRange.label}
        </p>
      ) : (
        <>
        <p className="text-sm font-extrabold leading-tight text-[var(--mazzi-text)]">{formatDateTimeBR(startAt)}</p>
          <p className="text-xs font-semibold text-slate-600">até {formatDateTimeBR(endAt)}</p>
        </>
      )}
      {!editable && active && <p className="text-[11px] font-semibold text-slate-500">Histórico · período iniciado</p>}
    </div>
    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
      {editable && <Button variant="outline" size="sm" className="min-h-10 text-slate-600" onClick={onEdit} leftIcon={<Pencil className="w-3.5 h-3.5" />} aria-label="Editar bloqueio">Editar</Button>}
      {kind === 'days' && active && <Button variant="dangerSoft" size="sm" className="min-h-10" disabled={!editable || working} isLoading={working} onClick={onDeactivate} leftIcon={<PowerOff className="w-3.5 h-3.5" />} aria-label="Desativar bloqueio de dias">Desativar Bloqueio</Button>}
      {kind === 'days' && !active && editable && <Button variant="outline" size="sm" className="min-h-10 text-emerald-700" disabled={working} isLoading={working} onClick={onActivate} leftIcon={<Power className="w-3.5 h-3.5" />} aria-label="Ativar bloqueio de dias">Ativar bloqueio</Button>}
      {kind === 'quick' && <Button variant="dangerSoft" size="sm" className="min-h-10 disabled:opacity-40" disabled={!editable || deleting || working} isLoading={deleting || working} onClick={onDelete} leftIcon={<Trash2 className="w-3.5 h-3.5" />} aria-label="Excluir bloqueio">Excluir</Button>}
    </div>
  </article>
  );
};

export const ProviderScheduleTab: React.FC<ProviderScheduleTabProps> = ({
  scheduleSubTab,
  onSubTabChange,
  hideSubTabs = false,
  hideHeader = false,
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
  onDeactivateException,
  onActivateException,
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
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = React.useState(false);
  const [isSavingEmergencyBlock, setIsSavingEmergencyBlock] = React.useState(false);
  const [emergencyBlockError, setEmergencyBlockError] = React.useState<string | null>(null);
  const [emergencySelectedDate, setEmergencySelectedDate] = React.useState('');
  const [emergencySelectedSlots, setEmergencySelectedSlots] = React.useState<EmergencyBlockableSlot[]>([]);
  const [emergencyReasonPreset, setEmergencyReasonPreset] = React.useState('');
  const [emergencyEditingBlockId, setEmergencyEditingBlockId] = React.useState<string | undefined>();
  const [emergencyEditingSlotsByDate, setEmergencyEditingSlotsByDate] = React.useState<Record<string, EmergencyBlockableSlot[]> | null>(null);
  const canChangeBlock = (startAt: string) => new Date(startAt).getTime() > Date.now();
  const sortedGlobalBlocks = React.useMemo(() => [...(instructorGlobalBlocks || [])].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()), [instructorGlobalBlocks]);
  const sortedExceptions = React.useMemo(() => [...availabilityExceptions].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()), [availabilityExceptions]);
  const runAsyncAction = async (key: string, action: () => Promise<void>) => {
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await action();
    } finally {
      setPendingAction(null);
    }
  };

  const blockCardItems = React.useMemo<ScheduleBlockCardItem[]>(() => [
    ...(isInstructorUser ? sortedGlobalBlocks.map((block) => ({
      id: `global-${block.id}`, kind: 'quick' as const, startAt: block.start_at, endAt: block.end_at, reason: block.reason, editable: canChangeBlock(block.start_at), active: true,
      onEdit: () => handleOpenEditGlobalBlock(block), onDelete: () => void handleDeleteGlobalBlockClick(block.id), deleting: deletingGlobalBlockId === block.id,
    })) : []),
    ...sortedExceptions.map((exception) => ({
      id: exception.id, kind: 'days' as const, startAt: exception.startAt, endAt: exception.endAt, reason: exception.reason, active: exception.isActive !== false, editable: canChangeBlock(exception.startAt),
      onEdit: () => handleEditException(exception), onDelete: () => runAsyncAction(`exception-delete-${exception.id}`, () => onDeleteException(exception.id)), onDeactivate: () => onDeactivateException ? runAsyncAction(`exception-deactivate-${exception.id}`, () => onDeactivateException(exception.id)) : undefined, onActivate: () => onActivateException ? runAsyncAction(`exception-activate-${exception.id}`, () => onActivateException(exception.id)) : undefined,
      working: pendingAction?.endsWith(`-${exception.id}`) === true,
    })),
  ].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()), [isInstructorUser, sortedGlobalBlocks, sortedExceptions, deletingGlobalBlockId, onActivateException, pendingAction]);

  const handleEditException = (exception: AvailabilityException) => {
    if (!canChangeBlock(exception.startAt)) return;
    onExceptionFormChange({
      type: exception.type,
      reasonCategory: exception.reasonCategory,
      reason: exception.reason,
      startDate: getBusinessDateFromTimestamp(exception.startAt),
      endDate: getBusinessDateFromTimestamp(exception.endAt),
      vehicleId: exception.vehicleId || '',
      id: exception.id,
    });
    onOpenAddExceptionModal();
  };

  const openEmergencyBlockModal = () => {
    const firstDate = Object.keys(emergencySlotsByDate).sort()[0] || getTodayInSaoPaulo();
    setEmergencySelectedDate(firstDate);
    setEmergencySelectedSlots([]);
    setEmergencyReason('');
    setEmergencyReasonPreset('');
    setEmergencyEditingBlockId(undefined);
    setEmergencyEditingSlotsByDate(null);
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
    const normalizedSlots = normalizeContiguousHourRange(emergencySelectedSlots);
    if (!normalizedSlots || !isContiguousHourRange(normalizedSlots)) {
      setEmergencyBlockError('Selecione horários consecutivos para criar o bloqueio.');
      return;
    }
    setIsSavingEmergencyBlock(true);
    try {
      await onSaveEmergencyBlock(
        normalizedSlots[0].startAt,
        normalizedSlots[normalizedSlots.length - 1].endAt,
        emergencyReason.trim() || undefined,
        emergencyEditingBlockId,
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
      const scheduleOffering = offerings.find((offering) => offering.instructorId) || offerings[0];
      result[key] = generateEmergencyBlockableSlots({ date: key, rules: availabilityRules, bookings, globalBlocks: instructorGlobalBlocks || [], exceptions: availabilityExceptions, providerId: scheduleOffering?.providerId, instructorId: scheduleOffering?.instructorId });
    }
    return result;
  }, [availabilityRules, bookings, instructorGlobalBlocks, availabilityExceptions, offerings, calendarLoadError]);

  const handleOpenCreateGlobalBlock = () => {
    setEditingGlobalBlockId(null);
    setGlobalBlockForm({
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      reason: '',
    });
    setGlobalBlockError(null);
    setIsAddGlobalBlockModalOpen(true);
  };

  const handleOpenEditGlobalBlock = (gb: any) => {
    if (!canChangeBlock(gb.end_at)) return;
    const date = getBusinessDateFromTimestamp(gb.start_at);
    const editableDateSlots = generateEmergencyBlockableSlots({
      date,
      rules: availabilityRules,
      bookings,
      globalBlocks: (instructorGlobalBlocks || []).filter((block) => block.id !== gb.id),
      exceptions: availabilityExceptions,
      providerId: offerings[0]?.providerId,
      instructorId: offerings.find((offering) => offering.instructorId)?.instructorId,
    });
    const selectedSlots = editableDateSlots.filter((slot) => new Date(slot.startAt) >= new Date(gb.start_at) && new Date(slot.endAt) <= new Date(gb.end_at));
    setEmergencyEditingSlotsByDate({ ...emergencySlotsByDate, [date]: editableDateSlots });
    setEmergencySelectedDate(date);
    setEmergencySelectedSlots(selectedSlots);
    setEmergencyReason(gb.reason || '');
    setEmergencyReasonPreset('');
    setEmergencyEditingBlockId(gb.id);
    setEmergencyBlockError(null);
    setIsEmergencyModalOpen(true);
    return;
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
    const block = (instructorGlobalBlocks || []).find((item) => item.id === blockId);
    if (block && !canChangeBlock(block.end_at)) return;
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

  const recurringRuleFooter = (
    <>
      <Button variant="dangerSoft" size="sm" onClick={onCloseAddRuleModal} disabled={isSavingRule}>Cancelar</Button>
      <Button variant="primary" size="sm" onClick={onSaveRule} isLoading={isSavingRule}>
        {editingRuleId ? 'Salvar Alterações' : 'Salvar Regra'}
      </Button>
    </>
  );
  const emergencyBlockFooter = (
    <>
      <Button variant="dangerSoft" size="sm" onClick={() => setIsEmergencyModalOpen(false)} disabled={isSavingEmergencyBlock}>Cancelar</Button>
      <Button variant="primary" size="sm" onClick={saveEmergencyBlock} isLoading={isSavingEmergencyBlock}>Bloquear horário</Button>
    </>
  );
  const exceptionFooter = (
    <>
      <Button variant="dangerSoft" size="sm" onClick={onCloseAddExceptionModal} disabled={pendingAction !== null}>Cancelar</Button>
      <Button variant="primary" size="sm" onClick={() => void runAsyncAction('exception-save', onSaveException)} disabled={pendingAction !== null} isLoading={pendingAction === 'exception-save'}>Salvar Bloqueio</Button>
    </>
  );

  return (
    <div className={`space-y-6 text-left ${hideHeader ? 'pt-6' : ''}`}>
      {/* Header */}
      {!hideHeader && <AppPageHeader eyebrow="Sua jornada" title="Agenda & Horários" subtitle="Organize seus horários e disponibilidade." />}

      {/* Subtabs Switcher */}
      {!hideSubTabs && <div className="mazzi-segmented overflow-x-auto">
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
      </div>}
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
            <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={onOpenAddExceptionModal} leftIcon={<Ban className="w-4 h-4" />}>
              Bloqueio de dias
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
                    <span className="text-sm font-bold text-[var(--mazzi-text)]">
                        {DAY_OF_WEEK_LABELS_PT[rule.dayOfWeek]}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Ativa
                      </span>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--mazzi-text)]">
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
                      onClick={() => void runAsyncAction(`rule-delete-${rule.id}`, () => onDeleteRule(rule.id))}
                      disabled={pendingAction !== null}
                      isLoading={pendingAction === `rule-delete-${rule.id}`}
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
          {globalBlockActionError && (
            <div role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-extrabold text-rose-950 flex items-center justify-between gap-3">
              <span>{globalBlockActionError}</span>
              <ButtonBase type="button" onClick={() => setGlobalBlockActionError(null)} className="text-rose-600 hover:text-rose-900 font-bold cursor-pointer">
                <X className="h-4 w-4" aria-hidden="true" />
              </ButtonBase>
            </div>
          )}

          {(!isInstructorUser || instructorGlobalBlocks.length === 0) && availabilityExceptions.length === 0 ? (
            <EmptyState
              title="Nenhum bloqueio cadastrado"
              description="Sua agenda não possui bloqueios rápidos ou bloqueios de dias programados."
            />
          ) : (
            <div className="space-y-3">
              {blockCardItems.map((item) => <ScheduleBlockCard key={item.id} {...item} />)}
              {/*
              {isInstructorUser && sortedGlobalBlocks.map((gb) => {
                const editable = canChangeBlock(gb.end_at);
                return (
                <div key={`global-${gb.id}`} className="rounded-2xl border border-[#e9e6de] bg-white p-4 shadow-xs flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <Badge variant="warning">Bloqueio rápido</Badge>
                    <p className="text-xs font-bold text-[var(--mazzi-text)]">{formatDateTimeBR(gb.start_at)} até {formatDateTimeBR(gb.end_at)}</p>
                    {gb.reason && <p className="text-xs text-slate-600 font-medium">{gb.reason}</p>}
                    {!editable && <p className="text-[11px] font-semibold text-slate-400">Histórico · período encerrado</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={!editable} onClick={() => handleOpenEditGlobalBlock(gb)} aria-label="Editar bloqueio rápido"><Pencil className="w-3.5 h-3.5" /></Button>
                    {onDeleteGlobalBlock && <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 disabled:opacity-40" disabled={!editable || deletingGlobalBlockId === gb.id} isLoading={deletingGlobalBlockId === gb.id} onClick={() => handleDeleteGlobalBlockClick(gb.id)} aria-label="Excluir bloqueio rápido"><Trash2 className="w-3.5 h-3.5" /></Button>}
                  </div>
                </div>
                );
              })}
              */}
              {/* {sortedExceptions.map((exc) => {
                const editable = canChangeBlock(exc.endAt);
                return (
                <div
                  key={exc.id}
                  className="rounded-2xl border border-[#e9e6de] bg-white p-4 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">Bloqueio de dias</Badge>
                      <span className="text-xs font-bold text-[var(--mazzi-text)]">{exc.reason || 'Folga / indisponibilidade'}</span>
                    </div>
                      <p className="text-xs text-slate-500 font-medium">
                        De: {new Date(exc.startAt).toLocaleString('pt-BR')} até {new Date(exc.endAt).toLocaleString('pt-BR')}
                        {!editable && <span className="ml-1 text-[11px] font-semibold text-slate-400">· Histórico</span>}
                      </p>
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => handleEditException(exc)} disabled={!editable} className="shrink-0 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Editar bloqueio de dias">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteException(exc.id)}
                    disabled={!editable}
                    className="shrink-0 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                    aria-label="Excluir bloqueio de dias"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                );
              })} */}
            </div>
          )}
        </div>
      )}

      {/* SIMULATOR SUBTAB */}
      {false && (
        <div className="p-5 rounded-3xl bg-white border border-[#e9e6de] shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--mazzi-text)]">
            <Sparkles className="w-4 h-4 text-[#f6c945]" />
            <span>Simulador do Gerador de Vagas</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Selecione a Oferta"
                value={simOfferingId}
                onChange={(e) => onSimOfferingIdChange(e.target.value)}
                options={[
                  { value: '', label: 'Selecione uma oferta...' },
                  ...offerings.map((o) => ({ value: o.id, label: `${o.category} - ${o.durationMinutes} min (R$ ${(o.priceInCents / 100).toFixed(2)})` })),
                ]}
              />
            </div>
            <div>
              <label className="mazzi-field-label block mb-1">Selecione a Data</label>
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
      <Modal isOpen={isAddRuleModalOpen} onClose={onCloseAddRuleModal} title={editingRuleId ? 'Editar Regra Semanal' : 'Cadastrar Regra Semanal'} footer={recurringRuleFooter}>
        <div className="space-y-4 text-left">
          {ruleError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{ruleError}</span>
            </div>
          )}

          <div>
            <Select
              label="Dia da Semana *"
              value={ruleForm.dayOfWeek}
              onChange={(e) => onRuleFormChange({ ...ruleForm, dayOfWeek: e.target.value as DayOfWeek })}
              options={DAY_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Horário Inicial *"
                value={ruleForm.startTime}
                onChange={(event) => onRuleFormChange({ ...ruleForm, startTime: event.target.value })}
                options={HOUR_OPTIONS}
              />
            </div>
            <div>
              <Select
                label="Horário Final *"
                value={ruleForm.endTime}
                onChange={(event) => onRuleFormChange({ ...ruleForm, endTime: event.target.value })}
                options={HOUR_OPTIONS}
              />
            </div>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-medium text-sky-800">
            Para manter a agenda organizada, escolha horários em hora cheia, como 08:00, 09:00 ou 10:00. Horários como 08:30 não são permitidos.
          </div>

        </div>
      </Modal>

      <Modal isOpen={isEmergencyModalOpen} onClose={() => !isSavingEmergencyBlock && setIsEmergencyModalOpen(false)} title={emergencyEditingBlockId ? 'Editar bloqueio rápido' : 'Bloqueio rápido'} footer={emergencyBlockFooter}>
        <div className="space-y-4 text-left">
          <p className="text-xs leading-relaxed text-slate-600">Escolha uma data e um horário realmente livre na sua agenda.</p>
          {emergencyBlockError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{emergencyBlockError}</div>}
          <DateTimeSlotPicker slotsByDate={emergencyEditingSlotsByDate || emergencySlotsByDate} selectedDate={emergencySelectedDate} selectionMode="hour-range" selectedSlots={emergencySelectedSlots} onDateChange={(date) => { setEmergencySelectedDate(date); setEmergencySelectedSlots([]); }} onSlotsChange={setEmergencySelectedSlots} />
          {emergencySelectedSlots.length > 0 && <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700"><span>Bloqueando do horário {emergencySelectedSlots[0].startTime} até {emergencySelectedSlots[emergencySelectedSlots.length - 1].endTime} · {emergencySelectedSlots.length} {emergencySelectedSlots.length === 1 ? 'hora selecionada' : 'horas selecionadas'}</span><Button type="button" variant="ghost" size="sm" className="shrink-0 text-slate-600" onClick={() => setEmergencySelectedSlots([])}>Limpar</Button></div>}
          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Motivo (opcional)</p>
            <ReasonChips
              options={QUICK_BLOCK_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              value={emergencyReasonPreset}
              onChange={(value) => {
                setEmergencyReasonPreset(value);
                setEmergencyReason(value === 'OUTRO' ? '' : QUICK_BLOCK_REASON_OPTIONS.find((option) => option.value === value)?.label || '');
              }}
              ariaLabel="Motivos do bloqueio rápido"
            />
            {emergencyReasonPreset === 'OUTRO' && <Input placeholder="Descreva o motivo (opcional)" value={emergencyReason} onChange={(event) => setEmergencyReason(event.target.value)} />}
          </div>
        </div>
      </Modal>

      {/* ADD EXCEPTION MODAL */}
      <Modal isOpen={isAddExceptionModalOpen} onClose={onCloseAddExceptionModal} title="Cadastrar Bloqueio / Exceção" footer={exceptionFooter}>
        <div className="space-y-4 text-left">
          {exceptionError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{exceptionError}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="mazzi-field-label block">Motivo do Bloqueio *</label>
            <ReasonChips
              options={BLOCK_REASON_OPTIONS}
              value={exceptionForm.reasonCategory}
              onChange={(value) => onExceptionFormChange({ ...exceptionForm, reasonCategory: value, reason: value === 'OTHER' ? '' : BLOCK_REASON_OPTIONS.find((option) => option.value === value)?.label || '' })}
              ariaLabel="Motivos do bloqueio"
            />
            <Textarea
              rows={2}
              value={exceptionForm.reasonCategory === 'OTHER' ? exceptionForm.reason : ''}
              onChange={(e) => onExceptionFormChange({ ...exceptionForm, reason: e.target.value })}
              placeholder="Observações adicionais (opcional)..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-amber-200"
              aria-label="Observações adicionais opcionais"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mazzi-field-label block mb-1">Data Início *</label>
              <DateInput
                value={exceptionForm.startDate}
                onChange={(value) => onExceptionFormChange({ ...exceptionForm, startDate: value })}
              />
            </div>
            <div>
              <label className="mazzi-field-label block mb-1">Data Fim *</label>
              <DateInput
                value={exceptionForm.endDate}
                onChange={(value) => onExceptionFormChange({ ...exceptionForm, endDate: value })}
              />
            </div>
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
              <label className="mazzi-field-label block mb-1">Data Início *</label>
              <DateInput
                value={globalBlockForm.startDate}
                onChange={(value) => setGlobalBlockForm({ ...globalBlockForm, startDate: value })}
              />
            </div>
            <div>
              <label className="mazzi-field-label block mb-1">Hora Início *</label>
              <TimeInput
                value={globalBlockForm.startTime}
                onChange={(value) => setGlobalBlockForm({ ...globalBlockForm, startTime: value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mazzi-field-label block mb-1">Data Fim *</label>
              <DateInput
                value={globalBlockForm.endDate}
                onChange={(value) => setGlobalBlockForm({ ...globalBlockForm, endDate: value })}
              />
            </div>
            <div>
              <label className="mazzi-field-label block mb-1">Hora Fim *</label>
              <TimeInput
                value={globalBlockForm.endTime}
                onChange={(value) => setGlobalBlockForm({ ...globalBlockForm, endTime: value })}
              />
            </div>
          </div>

          <div>
            <label className="mazzi-field-label block mb-1">Motivo (Opcional)</label>
            <Input
              value={globalBlockForm.reason}
              onChange={(e) => setGlobalBlockForm({ ...globalBlockForm, reason: e.target.value })}
              placeholder="Ex: Férias, Compromisso pessoal, Exame médico"
            />
          </div>

          <ModalActionFooter>
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
          </ModalActionFooter>
        </div>
      </Modal>
    </div>
  );
};
