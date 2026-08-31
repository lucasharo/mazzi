import React from 'react';
import { AlertTriangle, ArrowLeft, XCircle, Info } from 'lucide-react';
import { Booking } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { ReasonChips } from '../../../components/ui/ReasonChips';
import { ProviderCancellationReasonCode } from '../../../domain/cancellation';

const PROVIDER_CANCEL_REASON_OPTIONS: { code: ProviderCancellationReasonCode; label: string }[] = [
  { code: 'SCHEDULE_CONFLICT', label: 'Conflito de agenda' },
  { code: 'VEHICLE_ISSUE', label: 'Problema no veículo' },
  { code: 'PERSONAL_EMERGENCY', label: 'Emergência pessoal' },
  { code: 'WEATHER_OR_SAFETY', label: 'Clima ou segurança' },
  { code: 'OPERATIONAL_ISSUE', label: 'Problema operacional' },
  { code: 'OTHER', label: 'Outro motivo' },
];

interface ProviderCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  reasonCode: ProviderCancellationReasonCode;
  onReasonCodeChange: (code: ProviderCancellationReasonCode) => void;
  customReason: string;
  onCustomReasonChange: (val: string) => void;
  onConfirmCancel: () => void;
  isProcessing: boolean;
  errorMessage: string | null;
}

export const ProviderCancellationModal: React.FC<ProviderCancellationModalProps> = ({
  isOpen,
  onClose,
  booking,
  reasonCode,
  onReasonCodeChange,
  customReason,
  onCustomReasonChange,
  onConfirmCancel,
  isProcessing,
  errorMessage,
}) => {
  if (!booking) return null;

  const isOther = reasonCode === 'OTHER';
  const isSubmitDisabled = isProcessing || (isOther && !customReason.trim());

  const footer = (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-w-0 flex-1 !whitespace-normal !px-2 text-center leading-tight min-h-[48px] rounded-2xl border-slate-300 bg-white font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
        onClick={onClose}
        disabled={isProcessing}
        leftIcon={<ArrowLeft className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
      >
        Manter aula
      </Button>
      <Button
        variant="danger"
        size="sm"
        className="min-w-0 flex-1 !whitespace-normal !px-2 text-center leading-tight min-h-[48px]"
        onClick={onConfirmCancel}
        disabled={isSubmitDisabled}
        isLoading={isProcessing}
        leftIcon={<XCircle className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />}
      >
        Cancelar aula
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancelar Agendamento (Instrutor)"
      footer={footer}
    >
      <div className="space-y-5 text-left">
        {/* Policy Warning Banner */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-amber-950">Política de Cancelamento (DEC-013):</p>
            <p>
              Ao realizar o cancelamento pelo instrutor, o agendamento será encerrado e o aluno receberá <strong>reembolso integral (100%)</strong> do valor pago.
            </p>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs space-y-1">
          <p className="font-extrabold text-slate-900">{booking.studentName}</p>
          <p className="text-slate-600">
            {booking.scheduledDate} • {booking.startTime} - {booking.endTime} (Cat. {booking.category})
          </p>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Reason Select */}
        <div className="space-y-2">
          <label className="mazzi-field-label block">
            Motivo do Cancelamento *
          </label>
          <ReasonChips
            options={PROVIDER_CANCEL_REASON_OPTIONS.map((option) => ({ value: option.code, label: option.label }))}
            value={reasonCode}
            onChange={onReasonCodeChange}
            ariaLabel="Motivos do cancelamento"
          />
        </div>

        {/* Custom Reason Text Input (Mandatory when OTHER) */}
        {isOther && (
          <div className="space-y-1">
            <label className="mazzi-field-label block">
              Descrição Detalhada do Motivo *
            </label>
            <Textarea
              rows={3}
              value={customReason}
              onChange={(e) => onCustomReasonChange(e.target.value)}
              placeholder="Descreva detalhadamente a justificativa para o cancelamento..."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#202126]"
            />
            {isOther && !customReason.trim() && (
              <p className="text-[11px] font-bold text-rose-600">
                A descrição textual é obrigatória para a opção "Outro motivo".
              </p>
            )}
          </div>
        )}

      </div>
    </Modal>
  );
};
