import React, { useEffect, useState } from 'react';
import { Check, CircleX, Mail, ShieldCheck, UserPlus, UserRound } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
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

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try { await action(); setMessage(success); await load(); } catch { setMessage('Não foi possível concluir a ação.'); } finally { setBusy(false); }
  };

  if (!isSchool && !isInstructor) return null;

  return (
    <section className="rounded-3xl border border-[#e9e6de] bg-white p-5 shadow-xs space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Autoescola</p>
          <h3 className="text-lg font-bold text-slate-900">Vínculos e convites</h3>
        </div>
        <ShieldCheck className="h-5 w-5 text-amber-600" aria-hidden="true" />
      </div>

      {isSchool ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail do instrutor" type="email" aria-label="E-mail do instrutor" />
            <Button size="sm" onClick={() => run(() => dbService.createSchoolInstructorInvitation(provider.id, email), 'Convite enviado.')} disabled={busy || !email.trim()} leftIcon={<UserPlus className="h-4 w-4" />}>Convidar</Button>
          </div>
          {schoolInvitations.filter((item) => item.status === 'PENDING').map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
              <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{item.invited_email}</span>
              <Badge variant="warning">Pendente</Badge>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {memberships.map((item) => {
              const compliance = summary.find((entry) => entry.membershipId === item.id);
              return <div key={item.id} className="flex flex-col justify-between gap-4 rounded-3xl border border-[#e9e6de] bg-white p-5 shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><UserRound className="h-5 w-5" aria-hidden="true" /></span>
                      <div><p className="font-bold text-slate-900">{item.name || item.email || 'Instrutor'}</p><p className="text-xs text-slate-500">{item.email}</p></div>
                    </div>
                    <Badge variant={item.isActive ? 'success' : 'default'}>{item.membershipStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3"><Badge variant={compliance?.eligible ? 'success' : 'default'}>{compliance?.eligible ? 'Elegível' : 'Compliance pendente'}</Badge>{item.membershipStatus === 'PENDING_COMPLIANCE' && <Button size="sm" variant="secondary" onClick={() => run(() => dbService.tryActivateSchoolInstructorMembership(item.id), 'Vínculo ativado.')} disabled={busy} leftIcon={<Check className="h-4 w-4" />}>Ativar</Button>}</div>
                </div>
              </div>;
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
    </section>
  );
};
