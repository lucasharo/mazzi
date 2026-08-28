import React from 'react';
import { Check, Copy, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { formatCentsToBRL } from '../../../domain/money';

interface Props {
  amountInCents: number;
  isProcessing: boolean;
  status?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixExpiresAt?: string;
  copied: boolean;
  onCreate: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onCopy: () => void;
}

function formatExpiration(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const MercadoPagoPixCheckout: React.FC<Props> = ({
  amountInCents,
  isProcessing,
  status,
  pixQrCode,
  pixQrCodeBase64,
  pixExpiresAt,
  copied,
  onCreate,
  onRefresh,
  onCopy,
}) => {
  const expiration = formatExpiration(pixExpiresAt);

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-3 sm:p-4">
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-[var(--mazzi-text)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <span>Pix de teste Mercado Pago. A reserva só será confirmada após a identificação do pagamento.</span>
      </div>

      {!pixQrCode ? (
        <div className="space-y-3 py-3 text-center">
          <QrCode className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-[var(--mazzi-text)]">Gerar código Pix</p>
            <p className="mt-1 text-xs text-[var(--mazzi-muted)]">Valor: {formatCentsToBRL(amountInCents)}</p>
          </div>
          <Button type="button" variant="primary" size="sm" className="w-full font-bold" isLoading={isProcessing} disabled={isProcessing} onClick={() => { void onCreate(); }}>
            Gerar Pix
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          {pixQrCodeBase64 && (
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border border-[var(--mazzi-border)] bg-white p-2">
              <img src={`data:image/png;base64,${pixQrCodeBase64}`} alt="QR Code para pagamento Pix" className="h-full w-full object-contain" />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-[var(--mazzi-text)]">Aguardando pagamento</p>
            <p className="mt-1 text-xs text-[var(--mazzi-muted)]">Pague pelo aplicativo do seu banco e depois atualize o status.</p>
            {expiration && <p className="mt-1 text-[11px] font-medium text-amber-700">Código válido até {expiration}.</p>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-left font-mono text-[10px] leading-relaxed text-slate-600 break-all select-all">
            {pixQrCode}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" size="sm" className="w-full font-bold" onClick={onCopy} leftIcon={copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}>
              {copied ? 'Código copiado' : 'Copiar código'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-full font-bold" isLoading={isProcessing} disabled={isProcessing} onClick={() => { void onRefresh(); }} leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}>
              Atualizar status
            </Button>
          </div>
          {status && status !== 'PENDING' && <p role="status" className="text-xs font-semibold text-[var(--mazzi-text)]">Status atual: {status === 'PAID' ? 'Pago' : status === 'FAILED' ? 'Falhou' : status}</p>}
        </div>
      )}
    </div>
  );
};
