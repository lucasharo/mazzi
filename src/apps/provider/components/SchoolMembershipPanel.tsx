import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Check, CircleX, Mail, Power, PowerOff, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { dbService } from '../../../lib/db-service';
import type { SchoolInstructorComplianceSummary, SchoolMembership } from '../../../lib/db-service';
import { Provider } from '../../../types';

interface SchoolMembershipPanelProps {
  provider: Provider;
  isInstructor: boolean;
  isInviteModalOpen: boolean;
  onOpenInviteModal: () => void;
  onCloseInviteModal: () => void;
  onShowFeedback?: (type: 'success' | 'warning' | 'error' | 'info', title: string, description?: string) => void;
}

export const SchoolMembershipPanel: React.FC<SchoolMembershipPanelProps> = ({ provider, isInstructor, isInviteModalOpen, onOpenInviteModal, onCloseInviteModal, onShowFeedback }) => {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [schoolInvitations, setSchoolInvitations] = useState<any[]>([]);
  const [summary, setSummary] = useState<SchoolInstructorComplianceSummary[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'status' | 'error'>('status');
  const [membershipToRemove, setMembershipToRemove] = useState<SchoolMembership | null>(null);
  const [membershipToSuspend, setMembershipToSuspend] = useState<SchoolMembership | null>(null);

  const isSchool = provider.type === 'DRIVING_SCHOOL';
  const visibleMemberships = memberships.filter((membership) => membership.userId !== provider.userId);

  const load = async () => {
    try {
      if (isInstructor) setInvitations(await dbService.listMySchoolInvitations());
      if (isSchool) {
        const [nextMemberships, nextInvitations, nextSummary] = await Promise.all([
          dbService.listSchoolMemberships(provider.id),
          dbService.listSchoolInstructorInvitations(provider.id),
          dbService.getSchoolInstructorComplianceSummary(provider.id),
        ]);
        setMemberships(nextMemberships);
        setSchoolInvitations(nextInvitations);
        setSummary(nextSummary);
      }
    } catch {
      setMessageTone('error');
      setMessage('Não foi possível carregar os vínculos agora.');
    }
  };

  useEffect(() => { void load(); }, [provider.id, isInstructor, isSchool]);

  const run = async (action: () => Promise<unknown>, success: string, onError?: (message: string) => void, onSuccess?: () => void) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'success' in result && result.success === false) {
        throw new Error('ACTION_NOT_COMPLETED');
      }
      setMessageTone('status');
      setMessage(success);
      onSuccess?.();
      await load();
    } catch (error) {
      const technicalMessage = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error || '');
      setMessageTone('error');
      const friendlyMessage = technicalMessage.includes('PROVIDER_NOT_ACTIVE')
        ? 'A autoescola ainda não foi aprovada pelo Admin. Aguarde a aprovação para ativar o vínculo.'
        : 'Não foi possível concluir a ação.';
      if (onError) {
        setMessage(null);
        onError(friendlyMessage);
      } else {
        setMessage(friendlyMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = () => run(
    async () => {
      await dbService.createSchoolInstructorInvitation(provider.id, email);
      setEmail('');
      onCloseInviteModal();
    },
    'Convite enviado.',
  );

  if (!isSchool && !isInstructor) return null;

  return (
    <div className="space-y-4">
      {isSchool ? (
        <>
          {schoolInvitations.filter((item) => item.status === 'PENDING').map((item) => (
            <div key={item.id} className="mazzi-compact-card flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{item.invited_email}</span>
              <Badge variant="warning">Pendente</Badge>
            </div>
          ))}
          {visibleMemberships.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="h-8 w-8 text-slate-400" />}
              title="Nenhum instrutor vinculado"
              description="Convide um instrutor para começar a gerenciar os vínculos da autoescola."
              actionLabel="Convidar Instrutor"
              onAction={onOpenInviteModal}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visibleMemberships.map((item) => {
                const compliance = summary.find((entry) => entry.membershipId === item.id);
                const complianceApproved = compliance?.globalComplianceValid === true && compliance.membershipComplianceValid === true;
                const membershipLabel = item.membershipStatus === 'ACTIVE'
                  ? 'Ativo'
                  : item.membershipStatus === 'PENDING_COMPLIANCE'
                    ? 'Pendente'
                    : item.membershipStatus === 'SUSPENDED'
                      ? 'Desativado'
                    : item.membershipStatus === 'ENDED'
                      ? 'Removido'
                    : item.membershipStatus;
                return <div key={item.id} className="mazzi-card flex flex-col gap-4 rounded-2xl bg-white shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><ArrowLeftRight className="h-5 w-5" aria-hidden="true" /></span>
                        <div className="min-w-0 flex-1"><p className="truncate font-bold text-[var(--mazzi-text)]">{item.name || item.email || 'Instrutor'}</p><p className="truncate text-xs text-slate-500">{item.email}</p></div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge className="whitespace-nowrap" variant={item.isActive ? 'success' : 'default'}>{membershipLabel}</Badge>
                        <Badge className="whitespace-nowrap text-[10px]" variant={complianceApproved ? 'success' : 'warning'}>{complianceApproved ? 'Compliance aprovado' : 'Compliance pendente'}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <div className="flex w-full flex-wrap justify-end gap-2">
                        {item.membershipStatus !== 'ENDED' && <Button size="sm" variant="dangerSoft" onClick={() => setMembershipToRemove(item)} disabled={busy} leftIcon={<CircleX className="h-4 w-4" />}>Remover instrutor</Button>}
                        {item.membershipStatus === 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => setMembershipToSuspend(item)} disabled={busy} leftIcon={<PowerOff className="h-4 w-4" />}>Desativar</Button>}
                        {(item.membershipStatus === 'PENDING_COMPLIANCE' || item.membershipStatus === 'SUSPENDED') && <Button size="sm" variant="primary" onClick={() => run(() => dbService.tryActivateSchoolInstructorMembership(item.id), 'Vínculo ativado.', (description) => onShowFeedback?.('error', 'Não foi possível ativar o instrutor', description), () => onShowFeedback?.('success', 'Instrutor ativado', 'O vínculo voltou a ficar disponível para novas aulas.'))} disabled={busy} leftIcon={<Power className="h-4 w-4" />}>Ativar</Button>}
                      </div>
                    </div>
                  </div>
                </div>;
              })}
            </div>
          )}

          <Modal isOpen={isInviteModalOpen} onClose={onCloseInviteModal} title="Convidar Instrutor">
            <div className="space-y-5 text-left">
              <div className="mazzi-compact-card rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]">
                    <Mail className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h4 className="text-sm font-extrabold text-amber-950">O instrutor receberá um convite no app</h4>
                    <p className="mt-1 text-xs leading-relaxed text-amber-900">Depois de enviar, aguarde o instrutor abrir o convite e aceitar a solicitação no aplicativo MAZZI.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2.5 border-t border-amber-200/80 pt-3.5 text-xs leading-relaxed text-amber-950">
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                    <p><strong className="font-extrabold">O convite aparecerá na tela inicial do app do instrutor.</strong></p>
                  </div>
                  <div className="flex items-start gap-2 border-t border-amber-200/80 pt-2.5">
                    <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                    <p><strong className="font-extrabold">O vínculo só poderá ser ativado depois que o instrutor aceitar o convite e concluir o compliance.</strong></p>
                  </div>
                </div>
              </div>
              <Input
                label="E-mail do instrutor"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="instrutor@exemplo.com"
                type="email"
                aria-label="E-mail do instrutor"
                leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
              />
              <div className="mazzi-modal-actions flex justify-end gap-2 border-t border-[var(--mazzi-border)] pt-4">
                <Button variant="dangerSoft" size="sm" onClick={onCloseInviteModal}>Cancelar</Button>
                <Button size="sm" onClick={handleInvite} disabled={busy || !email.trim()} leftIcon={<UserPlus className="h-4 w-4" />}>Convidar</Button>
              </div>
            </div>
          </Modal>
          <Modal isOpen={Boolean(membershipToRemove)} onClose={() => setMembershipToRemove(null)} title="Remover instrutor">
            <div className="space-y-4 text-left">
              <p className="text-sm text-slate-700">
                Remover <strong>{membershipToRemove?.name || membershipToRemove?.email || 'este instrutor'}</strong> da autoescola?
              </p>
              <div className="mazzi-compact-card flex items-start gap-2 rounded-2xl border border-amber-200 bg-[#fff9e9] p-3.5 text-xs leading-relaxed text-amber-950">
                <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <p><strong className="font-extrabold">O histórico será preservado.</strong> O instrutor deixará de aparecer como disponível para novas aulas, mas poderá ser convidado novamente no futuro.</p>
              </div>
              <div className="mazzi-modal-actions flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setMembershipToRemove(null)} disabled={busy}>Manter vínculo</Button>
                <Button variant="danger" size="sm" onClick={() => {
                  if (!membershipToRemove) return;
                  const selectedMembership = membershipToRemove;
                  setMembershipToRemove(null);
                  void run(() => dbService.endSchoolInstructorMembership(selectedMembership.id, 'Removido pela autoescola'), 'Instrutor removido da autoescola.');
                }} disabled={busy} leftIcon={<CircleX className="h-4 w-4" />}>Remover instrutor</Button>
              </div>
            </div>
          </Modal>
          <Modal isOpen={Boolean(membershipToSuspend)} onClose={() => setMembershipToSuspend(null)} title="Desativar instrutor">
            <div className="space-y-4 text-left">
              <p className="text-sm text-slate-700">
                Desativar <strong>{membershipToSuspend?.name || membershipToSuspend?.email || 'este instrutor'}</strong>?
              </p>
              <p className="text-xs text-slate-500">O instrutor deixará de aparecer como disponível para novas aulas, mas o vínculo e o histórico serão preservados. Você poderá removê-lo depois, se necessário.</p>
              <div className="mazzi-modal-actions flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setMembershipToSuspend(null)} disabled={busy}>Manter ativo</Button>
                <Button variant="dangerSoft" size="sm" onClick={() => {
                  if (!membershipToSuspend) return;
                  const selectedMembership = membershipToSuspend;
                  setMembershipToSuspend(null);
                  void run(() => dbService.suspendSchoolInstructorMembership(selectedMembership.id, 'Desativado pela autoescola'), 'Instrutor desativado.');
                }} disabled={busy} leftIcon={<PowerOff className="h-4 w-4" />}>Desativar instrutor</Button>
              </div>
            </div>
          </Modal>
        </>
      ) : (
        invitations.filter((item) => item.status === 'PENDING').map((item) => (
          <div key={item.id} className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 p-3 text-center">
            <div><p className="font-semibold text-[var(--mazzi-text)]">{item.school_name}</p><p className="text-xs text-slate-500">Convite para atuar como instrutor</p></div>
            <div className="flex justify-center gap-2"><Button size="sm" onClick={() => run(() => dbService.acceptSchoolInstructorInvitation(item.id), 'Convite aceito.')} disabled={busy} leftIcon={<Check className="h-4 w-4" />}>Aceitar</Button><Button size="sm" variant="dangerSoft" onClick={() => run(() => dbService.declineSchoolInstructorInvitation(item.id), 'Convite recusado.')} disabled={busy} leftIcon={<CircleX className="h-4 w-4" />}>Recusar</Button></div>
          </div>
        ))
      )}
      {message && <p className={`text-xs ${messageTone === 'error' ? 'font-bold text-rose-700' : 'text-slate-500'}`} role={messageTone === 'error' ? 'alert' : 'status'}>{message}</p>}
    </div>
  );
};
