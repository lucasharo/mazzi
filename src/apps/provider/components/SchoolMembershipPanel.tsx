import React, { useEffect, useState } from 'react';
import { Check, CircleX, Mail, UserPlus, UserRound } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { dbService } from '../../../lib/db-service';
import type { SchoolInstructorComplianceSummary, SchoolMembership } from '../../../lib/db-service';
import { Provider } from '../../../types';

interface SchoolMembershipPanelProps {
  provider: Provider;
  isInstructor: boolean;
}

export const SchoolMembershipPanel: React.FC<SchoolMembershipPanelProps> = ({ provider, isInstructor }) => {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [schoolInvitations, setSchoolInvitations] = useState<any[]>([]);
  const [summary, setSummary] = useState<SchoolInstructorComplianceSummary[]>([]);
  const [email, setEmail] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const run = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try { await action(); setMessage(success); await load(); return true; } catch { setMessage('Não foi possível concluir a ação.'); return false; } finally { setBusy(false); }
  };

  const handleInvite = async () => {
    const succeeded = await run(
      () => dbService.createSchoolInstructorInvitation(provider.id, email.trim()),
      'Convite enviado.',
    );
    if (succeeded) {
      setEmail('');
      setIsInviteModalOpen(false);
    }
  };

  if (!isSchool && !isInstructor) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Autoescola</p>
          <h3 className="text-lg font-bold text-slate-900">Vínculos e convites</h3>
        </div>
        {isSchool && (
          <Button size="sm" onClick={() => setIsInviteModalOpen(true)} disabled={busy} leftIcon={<UserPlus className="h-4 w-4" />}>
            Convidar instrutor
          </Button>
        )}
      </div>

      {isSchool ? (
        <>
          {schoolInvitations.filter((item) => item.status === 'PENDING').map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
              <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{item.invited_email}</span>
              <Badge variant="warning">Pendente</Badge>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {memberships.map((item) => {
              const compliance = summary.find((entry) => entry.membershipId === item.id);
              return (
                <div key={item.id} className="p-5 rounded-3xl bg-white border border-[#e9e6de] shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserRound className="w-5 h-5 shrink-0 text-slate-900" aria-hidden="true" />
                        <h4 className="text-base font-bold text-slate-900 truncate">
                          {item.name || item.email || 'Instrutor'}
                        </h4>
                      </div>
                      <Badge variant={item.isActive ? 'success' : 'default'}>
                        {item.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="max-w-full truncate px-2.5 py-0.5 rounded-md bg-slate-100 text-[#202126] font-bold">
                        {item.email || 'E-mail não informado'}
                      </span>
                      <Badge variant={compliance?.eligible ? 'success' : 'default'} size="sm">
                        {compliance?.eligible ? 'Elegível' : 'Compliance pendente'}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-500">
                      Status do vínculo: <span className="font-bold text-slate-900">{item.membershipStatus}</span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-400">
                      ID: {item.id.slice(0, 8)}
                    </span>
                    {item.membershipStatus === 'PENDING_COMPLIANCE' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => run(() => dbService.tryActivateSchoolInstructorMembership(item.id), 'Vínculo ativado.')}
                        disabled={busy}
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                      >
                        Ativar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
      <Modal isOpen={isInviteModalOpen && isSchool} onClose={() => setIsInviteModalOpen(false)} title="Convidar instrutor" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Informe o e-mail do instrutor para enviar um convite de vínculo.</p>
          <div>
            <label htmlFor="school-instructor-email" className="mb-1 block text-xs font-bold text-slate-900">E-mail do instrutor</label>
            <Input
              id="school-instructor-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="instrutor@mazzi.com.br"
              type="email"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="dangerSoft" size="sm" onClick={() => setIsInviteModalOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleInvite} disabled={busy || !email.trim()} leftIcon={<UserPlus className="h-4 w-4" />}>
              Enviar convite
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};
