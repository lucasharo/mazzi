import React, { useEffect, useState } from 'react';
import { QrCode, Save } from 'lucide-react';
import type { PixDestination, PixKeyType } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface ProviderPixDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixDestination?: PixDestination | null;
  onSave: (input: Pick<PixDestination, 'keyType' | 'pixKey' | 'holderName' | 'holderDocument'>) => Promise<void>;
  isSaving?: boolean;
}

export const ProviderPixDestinationModal: React.FC<ProviderPixDestinationModalProps> = ({
  isOpen,
  onClose,
  pixDestination,
  onSave,
  isSaving = false,
}) => {
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>(pixDestination?.keyType || 'CPF');
  const [pixKey, setPixKey] = useState(pixDestination?.pixKey || '');
  const [holderName, setHolderName] = useState(pixDestination?.holderName || '');
  const [holderDocument, setHolderDocument] = useState(pixDestination?.holderDocument || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPixKeyType(pixDestination?.keyType || 'CPF');
    setPixKey(pixDestination?.pixKey || '');
    setHolderName(pixDestination?.holderName || '');
    setHolderDocument(pixDestination?.holderDocument || '');
  }, [pixDestination]);

  const isValid = pixKey.trim().length > 0 && holderName.trim().length >= 3;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSaving) return;

    setError(null);
    try {
      await onSave({
        keyType: pixKeyType,
        pixKey: pixKey.trim(),
        holderName: holderName.trim(),
        holderDocument: holderDocument.trim(),
      });
      onClose();
    } catch {
      setError('Não foi possível salvar o destino Pix. Revise os dados e tente novamente.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Destino para recebimentos Pix"
      size="lg"
      footer={(
        <>
          <Button type="button" variant="dangerSoft" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="provider-pix-destination-form"
            variant="primary"
            size="sm"
            isLoading={isSaving}
            disabled={!isValid}
            leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
          >
            Salvar chave Pix
          </Button>
        </>
      )}
    >
      <form id="provider-pix-destination-form" className="space-y-4 text-left" onSubmit={(event) => { void handleSubmit(event); }}>
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] text-amber-700">
            <QrCode className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Dados de recebimento</h4>
            <p className="mt-1 text-xs text-[var(--mazzi-muted)]">Cadastre a chave que será usada pelo Admin nos repasses manuais.</p>
          </div>
        </div>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-pix-key-type">Tipo de chave *</label>
            <select
              id="provider-pix-key-type"
              value={pixKeyType}
              onChange={(event) => setPixKeyType(event.target.value as PixKeyType)}
              className="min-h-11 w-full rounded-2xl border border-[var(--mazzi-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--mazzi-text)] focus:border-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)]"
            >
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Celular</option>
              <option value="RANDOM">Chave aleatória</option>
            </select>
          </div>
          <div>
            <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-pix-key">Chave Pix *</label>
            <Input id="provider-pix-key" value={pixKey} onChange={(event) => setPixKey(event.target.value)} placeholder={pixKeyType === 'EMAIL' ? 'contato@exemplo.com.br' : 'Informe sua chave Pix'} />
          </div>
          <div>
            <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-pix-holder">Nome do titular *</label>
            <Input id="provider-pix-holder" value={holderName} onChange={(event) => setHolderName(event.target.value)} placeholder="Nome completo ou razão social" />
          </div>
          <div>
            <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-pix-document">CPF/CNPJ do titular</label>
            <Input id="provider-pix-document" value={holderDocument} onChange={(event) => setHolderDocument(event.target.value)} placeholder="Opcional" />
          </div>
        </div>

        {pixDestination?.pixKeyMasked && (
          <p className="text-xs text-[var(--mazzi-muted)]">Chave cadastrada: <strong className="text-[var(--mazzi-text)]">{pixDestination.pixKeyMasked}</strong></p>
        )}
      </form>
    </Modal>
  );
};
