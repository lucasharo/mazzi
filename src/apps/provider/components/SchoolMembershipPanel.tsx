import React, { useEffect, useState } from 'react';
import { Check, CircleX, Mail, UserPlus, UserRound } from 'lucide-react';
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
}

export const SchoolMembershipPanel: React.FC<SchoolMembershipPanelProps> = ({ provider, isInstructor, isInviteModalOpen, onOpenInviteModal, onCloseInviteModal }) => {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [schoolInvitations, setSchoolInvitations] = useState<any[]>([]);
  const [summary, setSummary] = useState<SchoolInstructorComplianceSummary[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [membershipToRemove, setMembershipToRemove] = useState<SchoolMembership | null>(null);

  const isSchool = provider.type === 'DRIVING_SCHOOL';

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
      setMessage('Não foi possível carregar os vínculos agora.');
    }
  };

  useEffect(() => { void load(); }, [provider.id, isInstructor, isSchool]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try { await action(); setMessage(success); await load(); } catch { setMessage('Não foi possível concluir a ação.'); } finally { setBusy(false); }
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
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{item.invited_email}</span>
              <Badge variant="warning">Pendente</Badge>
            </div>
          ))}
          {memberships.length === 0 ? (
            <EmptyState
              icon={<UserRound className="h-8 w-8 text-slate-400" />}
              title="Nenhum instrutor vinculado"
              description="Convide um instrutor para começar a gerenciar os vínculos da autoescola."
              actionLabel="Convidar Instrutor"
              onAction={onOpenInviteModal}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {memberships.map((item) => {
                const compliance = summary.find((entry) => entry.membershipId === item.id);
                const membershipLabel = item.membershipStatus === 'ACTIVE'
                  ? 'Ativo'
                  : item.membershipStatus === 'PENDING_COMPLIANCE'
                    ? 'Pendente'
                    : item.membershipStatus === 'ENDED'
                      ? 'Removido'
                    : item.membershipStatus;
                return <div key={item.id} className="flex min-h-[190px] flex-col justify-between gap-4 rounded-3xl border border-[#e9e6de] bg-white p-5 shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><UserRound className="h-5 w-5" aria-hidden="true" /></span>
                        <div><p className="font-bold text-slate-900">{item.name || item.email || 'Instrutor'}</p><p className="text-xs text-slate-500">{item.email}</p></div>
                      </div>
                      <Badge variant={item.isActive ? 'success' : 'default'}>{membershipLabel}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <Badge variant={compliance?.eligible ? 'success' : 'default'}>{compliance?.eligible ? 'Elegível' : 'Compliance pendente'}</Badge>
                      <div className="flex flex-wrap justify-end gap-2">
                        {item.membershipStatus === 'PENDING_COMPLIANCE' && <Button size="sm" variant="secondary" onClick={() => run(() => dbService.tryActivateSchoolInstructorMembership(item.id), 'Vínculo ativado.')} disabled={busy} leftIcon={<Check className="h-4 w-4" />}>Ativar</Button>}
                        {item.membershipStatus !== 'ENDED' && <Button size="sm" variant="dangerSoft" onClick={() => setMembershipToRemove(item)} disabled={busy} leftIcon={<CircleX className="h-4 w-4" />}>Remover instrutor</Button>}
                      </div>
                    </div>
                  </div>
                </div>;
              })}
            </div>
          )}

          <Modal isOpen={isInviteModalOpen} onClose={onCloseInviteModal} title="Convidar Instrutor">
            <div className="space-y-4 text-left">
              <p className="text-xs text-slate-500">Envie um convite para o instrutor entrar na operação da autoescola.</p>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail do instrutor" type="email" aria-label="E-mail do instrutor" />
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
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
              <p className="text-xs text-slate-500">O histórico será preservado e o instrutor deixará de aparecer como disponível para novas aulas. Ele poderá ser convidado novamente no futuro.</p>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
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
        </>
      ) : (
        invitations.filter((item) => item.status === 'PENDING').map((item) => (
          <div key={item.id} className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 p-3 text-center">
            <div><p className="font-semibold text-slate-900">{item.school_name}</p><p className="text-xs text-slate-500">Convite para atuar como instrutor</p></div>
            <div className="flex justify-center gap-2"><Button size="sm" onClick={() => run(() => dbService.acceptSchoolInstructorInvitation(item.id), 'Convite aceito.')} disabled={busy} leftIcon={<Check className="h-4 w-4" />}>Aceitar</Button><Button size="sm" variant="dangerSoft" onClick={() => run(() => dbService.declineSchoolInstructorInvitation(item.id), 'Convite recusado.')} disabled={busy} leftIcon={<CircleX className="h-4 w-4" />}>Recusar</Button></div>
          </div>
        ))
      )}
      {message && <p className="text-xs text-slate-500" role="status">{message}</p>}
    </div>
  );
};
