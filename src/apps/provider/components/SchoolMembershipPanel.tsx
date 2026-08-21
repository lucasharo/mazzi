import React, { useEffect, useState } from 'react';
import { Check, Mail, ShieldCheck, UserPlus, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { dbService } from '../../../lib/db-service';
import { Provider } from '../../../types';

interface SchoolMembershipPanelProps {
  provider: Provider;
  isInstructor: boolean;
}

export const SchoolMembershipPanel: React.FC<SchoolMembershipPanelProps> = ({ provider, isInstructor }) => {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [schoolInvitations, setSchoolInvitations] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
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
          {memberships.map((item) => {
            const compliance = summary.find((entry) => entry.membership_id === item.id);
            return <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-slate-900">{item.name || item.email || 'Instrutor'}</p><p className="text-xs text-slate-500">{item.membership_status}</p></div>
              <div className="flex items-center gap-2"><Badge variant={compliance?.eligible ? 'success' : 'default'}>{compliance?.eligible ? 'Elegível' : 'Compliance pendente'}</Badge>{item.membership_status === 'PENDING_COMPLIANCE' && <Button size="sm" variant="secondary" onClick={() => run(() => dbService.tryActivateSchoolInstructorMembership(item.id), 'Vínculo ativado.')} disabled={busy} leftIcon={<Check className="h-4 w-4" />}>Ativar</Button>}</div>
            </div>;
          })}
        </>
      ) : (
        invitations.filter((item) => item.status === 'PENDING').map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-slate-900">{item.school_name}</p><p className="text-xs text-slate-500">Convite para atuar como instrutor</p></div>
            <div className="flex gap-2"><Button size="sm" onClick={() => run(() => dbService.acceptSchoolInstructorInvitation(item.id), 'Convite aceito.')} disabled={busy} leftIcon={<Check className="h-4 w-4" />}>Aceitar</Button><Button size="sm" variant="dangerSoft" onClick={() => run(() => dbService.declineSchoolInstructorInvitation(item.id), 'Convite recusado.')} disabled={busy} leftIcon={<X className="h-4 w-4" />}>Recusar</Button></div>
          </div>
        ))
      )}
      {message && <p className="text-xs text-slate-500" role="status">{message}</p>}
    </section>
  );
};
