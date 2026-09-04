import React, { useEffect, useState } from 'react';
import { instantConductService, type InstantConductCase } from '../../lib/instant-conduct-service';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

export function InstantConductPanel({ admin = false }: { admin?: boolean }) {
  const [cases, setCases] = useState<InstantConductCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = async () => {
    setLoading(true); setError('');
    try { setCases(await instantConductService.list()); }
    catch { setError('Não foi possível carregar as ocorrências. Tente atualizar.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { let active = true;
    void instantConductService.list().then(rows => { if (active) setCases(rows); })
      .catch(() => { if (active) setError('Não foi possível carregar as ocorrências. Tente atualizar.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const act = async (item: InstantConductCase, decision?: 'UNJUSTIFIED' | 'EXEMPT') => {
    setBusy(item.id); setError('');
    try {
      if (admin && decision) await instantConductService.review(item.id, decision, notes[item.id] || '');
      else await instantConductService.appeal(item.id, notes[item.id] || '');
      setNotes(previous => ({ ...previous, [item.id]: '' }));
      await load();
    } catch { setError('Não foi possível salvar. Verifique sua permissão e a justificativa.'); }
    finally { setBusy(null); }
  };
  return <section className="space-y-3 rounded-3xl border border-[var(--mazzi-border)] bg-white p-4" aria-label="Ocorrências da Aula Agora">
    <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Ocorrências da Aula Agora</h3><Button size="sm" variant="outline" onClick={() => void load()} isLoading={loading} disabled={busy !== null}>Atualizar</Button></div>
    <p className="text-sm text-slate-600">Cancelamento injustificado gera advertência. Ao atingir 3 em 30 dias, a Aula Agora fica suspensa por 24 horas. Aulas agendadas e repasses não são afetados.</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {!loading && !error && cases.length === 0 && <p className="text-sm text-slate-500">Nenhuma ocorrência registrada.</p>}
    {cases.map(item => {
      const suspended = item.suspension_until && new Date(item.suspension_until).getTime() > Date.now();
      const preventive = item.kind === 'NO_SHOW' && item.decision === 'PENDING';
      return <article key={item.id} className="space-y-2 rounded-2xl border border-slate-200 p-3">
        <h4 className="font-bold">{admin ? `${item.instructor_name} · ` : ''}{item.kind === 'NO_SHOW' ? 'Não comparecimento' : 'Cancelamento'} · {new Date(item.occurred_at).toLocaleDateString('pt-BR')}</h4>
        <p className="text-xs text-slate-500">Aula: {item.booking_id}</p>
        <p className="text-sm">{item.decision === 'EXEMPT' ? 'Isento de penalidade' : item.decision === 'PENDING' ? 'Aguardando análise' : 'Advertência registrada'}</p>
        {suspended && <p role="status" className="text-sm font-bold text-amber-800">Aula Agora suspensa até {new Date(item.suspension_until!).toLocaleString('pt-BR')}.</p>}
        {preventive && <p role="status" className="text-sm font-bold text-amber-800">Aula Agora suspensa preventivamente até a análise.</p>}
        {item.reason && <p className="text-sm">Motivo: {item.reason}</p>}
        {item.review_note && <p className="text-sm">Análise: {item.review_note}</p>}
        {item.appeal && <p className="text-sm">Contestação: {item.appeal}</p>}
        <Textarea aria-label={admin ? 'Justificativa da decisão' : 'Sua justificativa ou contestação'} placeholder={admin ? 'Justifique a decisão' : 'Explique sua justificativa ou conteste a decisão'} maxLength={2000} value={notes[item.id] || ''} onChange={event => setNotes(previous => ({ ...previous, [item.id]: event.target.value }))} />
        <div className="flex flex-wrap gap-2">
          {admin ? <><Button size="sm" variant="dangerSoft" disabled={busy !== null || (notes[item.id] || '').trim().length < 5} isLoading={busy === item.id} onClick={() => void act(item, 'UNJUSTIFIED')}>Confirmar injustificado</Button><Button size="sm" variant="outline" disabled={busy !== null || (notes[item.id] || '').trim().length < 5} onClick={() => void act(item, 'EXEMPT')}>Isentar penalidade</Button></> : <Button size="sm" variant="outline" disabled={busy !== null || (notes[item.id] || '').trim().length < 5} isLoading={busy === item.id} onClick={() => void act(item)}>Enviar para análise</Button>}
        </div>
      </article>;
    })}
  </section>;
}
