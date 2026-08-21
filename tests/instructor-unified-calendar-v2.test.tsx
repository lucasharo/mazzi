// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import { ProviderScheduleTab } from '../src/apps/provider/components/ProviderScheduleTab';
import { ProviderBookingsTab } from '../src/apps/provider/components/ProviderBookingsTab';
import { ProviderDashboardTab } from '../src/apps/provider/components/ProviderDashboardTab';
import { ProviderBookingDetailsModal } from '../src/apps/provider/components/ProviderBookingDetailsModal';
import { canProviderCommerciallyCancelBooking } from '../src/apps/provider/ProviderApp';
import { getTodayInSaoPaulo, getBusinessDateFromTimestamp, getTimeInSaoPaulo } from '../src/lib/date-format';

describe('TASK-054E — Unified Calendar Fail-Closed & Delete Error Visibility Tests', () => {
  afterEach(() => {
    cleanup();
  });

  const mig52Path = path.join(__dirname, '../supabase/migrations/20260818000052_provider_lesson_lifecycle_rpcs.sql');
  const mig53Path = path.join(__dirname, '../supabase/migrations/20260818000053_secure_booking_category_fallback.sql');
  const mig54Path = path.join(__dirname, '../supabase/migrations/20260818000054_instructor_unified_calendar_and_global_blocks.sql');
  const mig55Path = path.join(__dirname, '../supabase/migrations/20260820000055_fix_global_blocks_list_rpc_ambiguity.sql');

  // --- SQL SCHEMA & RPC IMMUTABILITY ASSERTIONS ---
  it('Migration 52, 53, 54 e 55 permanecem intocadas e com integridade de qualificação DDL', () => {
    expect(fs.existsSync(mig52Path)).toBe(true);
    expect(fs.existsSync(mig53Path)).toBe(true);
    expect(fs.existsSync(mig54Path)).toBe(true);
    expect(fs.existsSync(mig55Path)).toBe(true);

    const sql55 = fs.readFileSync(mig55Path, 'utf8');
    expect(sql55).toContain('FROM public.users AS u');
    expect(sql55).toContain('WHERE u.id = v_uid');
    expect(sql55).not.toMatch(/FROM\s+public\.users\s+WHERE\s+id\s*=\s*v_uid/i);
  });

  // --- 1. REAL COMPONENT TESTS: ProviderScheduleTab & Global Block Delete Error ---
  describe('ProviderScheduleTab Real UI Component & Delete Error Tests', () => {
    const defaultProps = {
      scheduleSubTab: 'exceptions' as const,
      onSubTabChange: vi.fn(),
      availabilityRules: [],
      availabilityExceptions: [],
      offerings: [],
      vehicles: [],
      isAddRuleModalOpen: false,
      onOpenAddRuleModal: vi.fn(),
      onCloseAddRuleModal: vi.fn(),
      ruleForm: { dayOfWeek: 'MONDAY' as const, startTime: '08:00', endTime: '18:00' },
      onRuleFormChange: vi.fn(),
      onSaveRule: vi.fn(),
      onDeleteRule: vi.fn(),
      ruleError: null,
      isAddExceptionModalOpen: false,
      onOpenAddExceptionModal: vi.fn(),
      onCloseAddExceptionModal: vi.fn(),
      exceptionForm: {
        type: 'BLOCK' as const,
        reasonCategory: 'PERSONAL' as const,
        reason: '',
        startDate: '',
        startTime: '08:00',
        endDate: '',
        endTime: '18:00',
        vehicleId: '',
      },
      onExceptionFormChange: vi.fn(),
      onSaveException: vi.fn(),
      onDeleteException: vi.fn(),
      exceptionError: null,
      simOfferingId: '',
      onSimOfferingIdChange: vi.fn(),
      simDate: '',
      onSimDateChange: vi.fn(),
      isInstructorUser: true,
      instructorGlobalBlocks: [],
      onSaveGlobalBlock: vi.fn().mockResolvedValue({ success: true }),
      onDeleteGlobalBlock: vi.fn().mockResolvedValue({ success: true }),
    };

    it('A. Clicar "Novo Bloqueio Pessoal" abre o modal global (Cadastrar Bloqueio Pessoal Global)', () => {
      render(<ProviderScheduleTab {...defaultProps} />);
      const newBtn = screen.getByRole('button', { name: /Novo Bloqueio Pessoal/i });
      fireEvent.click(newBtn);

      expect(screen.getByText('Cadastrar Bloqueio Pessoal Global')).toBeTruthy();
    });

    it('B. "Novo Bloqueio Pessoal" NÃO abre o modal de availability exceptions da autoescola', () => {
      render(<ProviderScheduleTab {...defaultProps} />);
      const newBtn = screen.getByRole('button', { name: /Novo Bloqueio Pessoal/i });
      fireEvent.click(newBtn);

      expect(defaultProps.onOpenAddExceptionModal).toHaveBeenCalledTimes(0);
      expect(screen.queryByText('Cadastrar Bloqueio / Exceção')).toBeNull();
    });

    it('C & D. Preencher formulário e salvar chama onSaveGlobalBlock 1x e onSaveException 0x', async () => {
      const onSaveGlobalBlockMock = vi.fn().mockResolvedValue({ success: true });
      const onSaveExceptionMock = vi.fn();

      render(
        <ProviderScheduleTab
          {...defaultProps}
          onSaveGlobalBlock={onSaveGlobalBlockMock}
          onSaveException={onSaveExceptionMock}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Novo Bloqueio Pessoal/i }));

      const submitBtn = screen.getByRole('button', { name: /Salvar Bloqueio Pessoal/i, hidden: true });
      fireEvent.click(submitBtn);

      expect(onSaveGlobalBlockMock).toHaveBeenCalledTimes(1);
      expect(onSaveExceptionMock).toHaveBeenCalledTimes(0);
    });

    it('F. end <= start mostra erro de validação no modal e não envia requisição', () => {
      const onSaveGlobalBlockMock = vi.fn();
      render(<ProviderScheduleTab {...defaultProps} onSaveGlobalBlock={onSaveGlobalBlockMock} />);

      fireEvent.click(screen.getByRole('button', { name: /Novo Bloqueio Pessoal/i }));

      const dateInputs = screen.getAllByDisplayValue(/2026|08:|18:/);
      if (dateInputs.length >= 4) {
        fireEvent.change(dateInputs[0], { target: { value: '2026-08-20' } });
        fireEvent.change(dateInputs[1], { target: { value: '18:00' } });
        fireEvent.change(dateInputs[2], { target: { value: '2026-08-20' } });
        fireEvent.change(dateInputs[3], { target: { value: '08:00' } });
      }

      const submitBtn = screen.getByRole('button', { name: /Salvar Bloqueio Pessoal/i, hidden: true });
      fireEvent.click(submitBtn);

      expect(screen.getByText('A data e hora final devem ser posteriores à data e hora inicial.')).toBeTruthy();
      expect(onSaveGlobalBlockMock).toHaveBeenCalledTimes(0);
    });

    it('G & H. Clicar Editar abre formulário com os dados do bloco e envia blockId no submit', () => {
      const mockBlocks = [
        {
          id: 'gb_edit_999',
          start_at: '2026-08-20T08:00:00-03:00',
          end_at: '2026-08-20T18:00:00-03:00',
          reason: 'Férias de Julho',
        },
      ];
      const onSaveGlobalBlockMock = vi.fn().mockResolvedValue({ success: true });

      render(
        <ProviderScheduleTab
          {...defaultProps}
          instructorGlobalBlocks={mockBlocks}
          onSaveGlobalBlock={onSaveGlobalBlockMock}
        />
      );

      const editButtons = screen.getAllByRole('button');
      const editBtn = editButtons.find((btn) => btn.querySelector('svg.lucide-pencil'));
      expect(editBtn).toBeTruthy();
      if (editBtn) fireEvent.click(editBtn);

      expect(screen.getByText('Editar Bloqueio Pessoal Global')).toBeTruthy();
      expect(screen.getByDisplayValue('Férias de Julho')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /Atualizar Bloqueio/i, hidden: true }));
      expect(onSaveGlobalBlockMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'Férias de Julho',
        'gb_edit_999'
      );
    });

    it('I & J. Clicar Excluir trata erro com modal fechado, exibe mensagem amigável no alerta da seção e NÃO expõe erro técnico', async () => {
      const mockBlocks = [
        {
          id: 'gb_del_123',
          start_at: '2026-08-20T08:00:00-03:00',
          end_at: '2026-08-20T18:00:00-03:00',
          reason: 'Bloqueio Teste Exclusão',
        },
      ];
      const onDeleteGlobalBlockMock = vi.fn().mockRejectedValue(new Error('DATABASE_CONNECTION_ERROR'));

      render(
        <ProviderScheduleTab
          {...defaultProps}
          instructorGlobalBlocks={mockBlocks}
          onDeleteGlobalBlock={onDeleteGlobalBlockMock}
        />
      );

      const deleteButtons = screen.getAllByRole('button');
      const deleteBtn = deleteButtons.find((btn) => btn.querySelector('svg.lucide-trash-2'));
      expect(deleteBtn).toBeTruthy();

      if (deleteBtn) fireEvent.click(deleteBtn);
      expect(onDeleteGlobalBlockMock).toHaveBeenCalledWith('gb_del_123');

      // Wait for friendly alert message in the open section (modal closed)
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeTruthy();
        expect(alert.textContent).toContain('Não foi possível excluir o bloqueio pessoal. Tente novamente.');
      });

      // Assert technical exception is NOT rendered literally
      expect(screen.queryByText(/DATABASE_CONNECTION_ERROR/)).toBeNull();
    });

    it('K. isInstructorUser = false oculta a seção de Bloqueios Pessoais Globais', () => {
      render(<ProviderScheduleTab {...defaultProps} isInstructorUser={false} />);
      expect(screen.queryAllByText('Bloqueios Pessoais Globais')).toHaveLength(0);
    });
  });

  // --- 2. REAL COMPONENT TESTS: ProviderDashboardTab Fail-Closed Completo ---
  describe('ProviderDashboardTab Fail-Closed Completo (TASK-054E)', () => {
    const defaultDashboardProps = {
      currentProvider: { id: 'p_1', name: 'Autoescola Teste', status: 'ACTIVE', ratingAverage: 4.9 } as any,
      todayBookings: [],
      confirmedBookings: [],
      completedBookings: [],
      nextBooking: null,
      providerDocs: [],
      providerVehicles: [],
      onSelectBooking: vi.fn(),
      onNavigateTab: vi.fn(),
      onOpenAddVehicleModal: vi.fn(),
      onOpenAddOfferingModal: vi.fn(),
      calendarLoadError: null,
    };

    it('Quando calendarLoadError != null, Dashboard oculta HERO, MÉTRICAS OPERACIONAIS e WIDGET PRÓXIMA AULA e NÃO exibe zeros falsos', () => {
      render(
        <ProviderDashboardTab
          {...defaultDashboardProps}
          calendarLoadError="Erro de conexão com agenda unificada"
        />
      );

      // Alert card is visible
      expect(screen.getByText('Agenda unificada indisponível')).toBeTruthy();

      // Calendar-derived labels and metrics MUST be absent
      expect(screen.queryByText('Aulas agendadas hoje')).toBeNull();
      expect(screen.queryByText('Aulas Hoje')).toBeNull();
      expect(screen.queryByText('Confirmadas')).toBeNull();
      expect(screen.queryByText('Concluídas')).toBeNull();
      expect(screen.queryByText('Próxima Aula Agendada')).toBeNull();
      expect(screen.queryByText('Sem agendamentos próximos')).toBeNull();
      expect(screen.queryByText('Nenhuma aula confirmada agendada para os próximos horários.')).toBeNull();

      // Non-calendar data remains visible
      expect(screen.getByText('Credenciamento Ativo • Verificado pela MAZZI')).toBeTruthy();
      expect(screen.getByText('Gestão de Veículos & Ofertas')).toBeTruthy();
      expect(screen.getByText('Avaliação do Perfil:')).toBeTruthy();
    });

    it('Quando calendarLoadError == null, Dashboard renderiza hero, métricas operacionais e widget da próxima aula normalmente', () => {
      render(<ProviderDashboardTab {...defaultDashboardProps} calendarLoadError={null} />);

      expect(screen.queryByText('Agenda unificada indisponível')).toBeNull();
      expect(screen.getByText('Aulas agendadas hoje')).toBeTruthy();
      expect(screen.getByText('Aulas Hoje')).toBeTruthy();
      expect(screen.getByText('Confirmadas')).toBeTruthy();
      expect(screen.getByText('Concluídas')).toBeTruthy();
      expect(screen.getByText('Próxima Aula Agendada')).toBeTruthy();
    });
  });

  // --- 3. REAL COMPONENT TESTS: ProviderBookingsTab Calendar Error ---
  describe('ProviderBookingsTab Calendar Error Real Component Tests', () => {
    const defaultBookingsProps = {
      bookingFilterTab: 'all' as const,
      onFilterTabChange: vi.fn(),
      filteredBookings: [],
      actionSuccessMessage: null,
      actionErrorMessage: null,
      onSelectBooking: vi.fn(),
      onOpenChat: vi.fn(),
      onCheckIn: vi.fn(),
      onStartLesson: vi.fn(),
      onCompleteLesson: vi.fn(),
      onCancelBooking: vi.fn(),
      isCompleting: false,
      calendarLoadError: null,
    };

    it('Quando calendarLoadError != null, exibe mensagem de erro + Retry e NÃO renderiza "Nenhum agendamento encontrado"', () => {
      render(
        <ProviderBookingsTab
          {...defaultBookingsProps}
          calendarLoadError="Falha ao sincronizar agenda"
          onRetryCalendarLoad={vi.fn()}
        />
      );

      expect(screen.getByText('Não foi possível carregar sua agenda completa.')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Tentar Novamente/i })).toBeTruthy();
      expect(screen.queryByText('Nenhum agendamento encontrado')).toBeNull();
    });

    it('Quando calendarLoadError == null e filteredBookings é [], renderiza normal EmptyState "Nenhum agendamento encontrado"', () => {
      render(<ProviderBookingsTab {...defaultBookingsProps} calendarLoadError={null} />);

      expect(screen.getByText('Nenhum agendamento encontrado')).toBeTruthy();
      expect(screen.queryByText('Não foi possível carregar sua agenda completa.')).toBeNull();
    });
  });

  // --- 4. EXPLICIT ROLE CANCELLATION MATRIX TESTS ---
  describe('Explicit Role Cancellation Matrix (canProviderCommerciallyCancelBooking)', () => {
    const privateProvider = { id: 'p_private_123', type: 'INSTRUCTOR' };
    const schoolProvider = { id: 'p_school_456', type: 'DRIVING_SCHOOL' };

    it('INSTRUCTOR + CONFIRMED + private provider (type INSTRUCTOR) -> true', () => {
      const b = { status: 'CONFIRMED', providerId: privateProvider.id };
      expect(canProviderCommerciallyCancelBooking(b, 'INSTRUCTOR', privateProvider)).toBe(true);
    });

    it('INSTRUCTOR + PENDING_PAYMENT -> false', () => {
      const b = { status: 'PENDING_PAYMENT', providerId: privateProvider.id };
      expect(canProviderCommerciallyCancelBooking(b, 'INSTRUCTOR', privateProvider)).toBe(false);
    });

    it('INSTRUCTOR + school provider (type DRIVING_SCHOOL) -> false', () => {
      const b = { status: 'CONFIRMED', providerId: schoolProvider.id };
      expect(canProviderCommerciallyCancelBooking(b, 'INSTRUCTOR', privateProvider)).toBe(false);
    });

    it('SCHOOL_ADMIN + own school -> true', () => {
      const b = { status: 'CONFIRMED', providerId: schoolProvider.id };
      expect(canProviderCommerciallyCancelBooking(b, 'SCHOOL_ADMIN', schoolProvider)).toBe(true);
    });

    it('DRIVING_SCHOOL + own school -> true', () => {
      const b = { status: 'CONFIRMED', providerId: schoolProvider.id };
      expect(canProviderCommerciallyCancelBooking(b, 'DRIVING_SCHOOL', schoolProvider)).toBe(true);
    });

    it('SCHOOL_STAFF -> false', () => {
      const b = { status: 'CONFIRMED', providerId: schoolProvider.id };
      expect(canProviderCommerciallyCancelBooking(b, 'SCHOOL_STAFF', schoolProvider)).toBe(false);
    });

    it('SUPPORT -> false', () => {
      const b = { status: 'CONFIRMED', providerId: schoolProvider.id };
      expect(canProviderCommerciallyCancelBooking(b, 'SUPPORT', schoolProvider)).toBe(false);
    });

    it('Unknown role / null -> false', () => {
      const b = { status: 'CONFIRMED', providerId: schoolProvider.id };
      expect(canProviderCommerciallyCancelBooking(b, undefined, schoolProvider)).toBe(false);
    });
  });

  // --- 5. TIMEZONE & UTC ROLLOVER TESTS ---
  describe('Timezone & UTC Rollover Guard Tests (America/Sao_Paulo)', () => {
    it('Cenário UTC Rollover: a 21:30 em SP (00:30 UTC do dia seguinte), getTodayInSaoPaulo() retorna o dia local em SP', () => {
      const lateNightUtc = new Date('2026-08-20T00:30:00Z');
      const todaySp = getTodayInSaoPaulo(lateNightUtc);

      expect(todaySp).toBe('2026-08-19');
    });

    it('Timestamp UTC de edição (2026-08-20T01:30:00Z) é convertido corretamente para data e hora em SP (2026-08-19 22:30)', () => {
      const timestampUtc = '2026-08-20T01:30:00Z';
      const dateSp = getBusinessDateFromTimestamp(timestampUtc);
      const timeSp = getTimeInSaoPaulo(timestampUtc);

      expect(dateSp).toBe('2026-08-19');
      expect(timeSp).toBe('22:30');
    });
  });

  // --- 6. MODAL AND LIST COMPONENT CANCELLATION BUTTON MATCHING ---
  describe('ProviderBookingDetailsModal Cancel Button Visibility Matching', () => {
    const defaultModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      booking: null as any,
      onOpenChat: vi.fn(),
      onCheckIn: vi.fn(),
      onStartLesson: vi.fn(),
      onCompleteLesson: vi.fn(),
      onCancelBooking: vi.fn(),
      isCompleting: false,
    };

    it('Para aula de autoescola atribuída ao instrutor, o modal NÃO exibe o botão Cancelar', () => {
      const schoolBooking = {
        id: 'bk_school_123',
        providerId: 'p_school_paulista',
        status: 'CONFIRMED',
        studentName: 'Aluno Teste',
        scheduledDate: '20/08/2026',
        startTime: '09:00',
        endTime: '10:00',
        category: 'B',
      };
      const privateProvider = { id: 'p_carlos_private', type: 'INSTRUCTOR' };

      render(
        <ProviderBookingDetailsModal
          {...defaultModalProps}
          booking={schoolBooking}
          canCancelBooking={(b) => canProviderCommerciallyCancelBooking(b, 'INSTRUCTOR', privateProvider)}
        />
      );

      expect(screen.queryByRole('button', { name: /^Cancelar$/i, hidden: true })).toBeNull();
    });

    it('Para aula particular CONFIRMED do próprio instrutor, o modal EXIBE o botão Cancelar', () => {
      const privateProvider = { id: 'p_carlos_private', type: 'INSTRUCTOR' };
      const privateBooking = {
        id: 'bk_private_123',
        providerId: privateProvider.id,
        status: 'CONFIRMED',
        studentName: 'Aluno Particular',
        scheduledDate: '20/08/2026',
        startTime: '09:00',
        endTime: '10:00',
        category: 'B',
      };

      render(
        <ProviderBookingDetailsModal
          {...defaultModalProps}
          booking={privateBooking}
          canCancelBooking={(b) => canProviderCommerciallyCancelBooking(b, 'INSTRUCTOR', privateProvider)}
        />
      );

      const cancelActionBtn = screen.getByRole('button', { name: /^Cancelar$/i, hidden: true });
      expect(cancelActionBtn.className).toContain('bg-rose-50');
      expect(cancelActionBtn.className).toContain('text-rose-700');
    });
  });
});
