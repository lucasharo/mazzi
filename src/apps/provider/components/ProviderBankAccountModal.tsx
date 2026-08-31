import React, { useEffect, useState } from 'react';
import { Building2, Save, ShieldCheck } from 'lucide-react';
import type { BankAccount, BankAccountType } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface ProviderBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccount?: BankAccount | null;
  onSave: (input: Omit<BankAccount, 'id' | 'providerId' | 'isActive' | 'updatedAt' | 'accountNumberMasked'>) => Promise<void>;
  isSaving?: boolean;
}

const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const ProviderBankAccountModal: React.FC<ProviderBankAccountModalProps> = ({
  isOpen,
  onClose,
  bankAccount,
  onSave,
  isSaving = false,
}) => {
  const [bankCode, setBankCode] = useState('');
  const [branchNumber, setBranchNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountDigit, setAccountDigit] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('CHECKING');
  const [holderName, setHolderName] = useState('');
  const [holderDocument, setHolderDocument] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBankCode('');
    setBranchNumber('');
    setAccountNumber('');
    setAccountDigit('');
    setAccountType(bankAccount?.accountType || 'CHECKING');
    setHolderName(bankAccount?.holderName || '');
    setHolderDocument(bankAccount?.holderDocument || '');
    setError(null);
  }, [bankAccount, isOpen]);

  const isValid = Boolean(
    bankCode.length === 3 &&
    branchNumber.length >= 3 &&
    accountNumber.length >= 3 &&
    accountDigit.length >= 1 &&
    holderName.trim().length >= 3,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSaving) return;

    setError(null);
    try {
      await onSave({
        bankCode,
        branchNumber,
        accountNumber,
        accountDigit,
        accountType,
        holderName: holderName.trim(),
        holderDocument: onlyDigits(holderDocument),
      });
      onClose();
    } catch {
      setError('Não foi possível salvar a conta bancária. Revise os dados e tente novamente.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conta bancária para recebimentos"
      size="lg"
      footer={(
        <>
          <Button type="button" variant="dangerSoft" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="provider-bank-account-form"
            variant="primary"
            size="sm"
            isLoading={isSaving}
            disabled={!isValid}
            leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
          >
            Salvar conta bancária
          </Button>
        </>
      )}
    >
      <form id="provider-bank-account-form" className="space-y-4 text-left" onSubmit={(event) => { void handleSubmit(event); }}>
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] text-amber-700">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Dados da conta bancária</h4>
            <p className="mt-1 text-xs text-[var(--mazzi-muted)]">Esses dados ficam protegidos e serão usados pelo Admin nos repasses.</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>Nunca informe senha, código de segurança ou dados de cartão.</span>
        </div>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Código do banco *" inputMode="numeric" maxLength={3} value={bankCode} onChange={(event) => setBankCode(onlyDigits(event.target.value).slice(0, 3))} placeholder="001" />
          <div>
            <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-bank-account-type">Tipo de conta *</label>
            <select
              id="provider-bank-account-type"
              value={accountType}
              onChange={(event) => setAccountType(event.target.value as BankAccountType)}
              className="min-h-11 w-full rounded-2xl border border-[var(--mazzi-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--mazzi-text)] focus:border-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)]"
            >
              <option value="CHECKING">Conta corrente</option>
              <option value="SAVINGS">Conta poupança</option>
            </select>
          </div>
          <Input label="Agência *" inputMode="numeric" maxLength={6} value={branchNumber} onChange={(event) => setBranchNumber(onlyDigits(event.target.value).slice(0, 6))} placeholder="0001" />
          <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-3">
            <Input label="Número da conta *" inputMode="numeric" maxLength={20} value={accountNumber} onChange={(event) => setAccountNumber(onlyDigits(event.target.value).slice(0, 20))} placeholder="123456789" />
            <Input label="Dígito *" inputMode="numeric" maxLength={2} value={accountDigit} onChange={(event) => setAccountDigit(onlyDigits(event.target.value).slice(0, 2))} placeholder="0" />
          </div>
          <Input label="Nome do titular *" value={holderName} onChange={(event) => setHolderName(event.target.value)} placeholder="Nome completo ou razão social" />
          <Input label="CPF/CNPJ do titular" inputMode="numeric" maxLength={14} value={holderDocument} onChange={(event) => setHolderDocument(onlyDigits(event.target.value).slice(0, 14))} placeholder="Opcional" />
        </div>

        {bankAccount?.isActive && bankAccount.accountNumberMasked && (
          <p className="text-xs text-[var(--mazzi-muted)]">Conta cadastrada: <strong className="text-[var(--mazzi-text)]">Banco {bankAccount.bankCode} · Ag. {bankAccount.branchNumber} · Conta {bankAccount.accountNumberMasked}</strong></p>
        )}
      </form>
    </Modal>
  );
};
