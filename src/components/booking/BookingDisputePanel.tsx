import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, MessageSquareWarning, Paperclip, Send, X } from 'lucide-react';
import type { Booking, BookingDispute, BookingDisputeEvidence, BookingDisputeReason } from '../../types';
import { dbService } from '../../lib/db-service';
import { Button, ButtonBase } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { mapFriendlyErrorMessage } from '../../lib/error-mapper';

const DISPUTES_CACHE_TTL_MS = 2_000;
type DisputesCacheEntry = {
  promise?: Promise<BookingDispute[]>;
  rows?: BookingDispute[];
  loadedAt?: number;
};
const disputesCache = new Map<string, DisputesCacheEntry>();

function getDisputesCacheKey(currentUserId?: string): string {
  return currentUserId || 'current-session';
}

function clearDisputesCache(currentUserId?: string): void {
  disputesCache.delete(getDisputesCacheKey(currentUserId));
}

function getCachedBookingDisputes(currentUserId?: string): Promise<BookingDispute[]> {
  const key = getDisputesCacheKey(currentUserId);
  const cached = disputesCache.get(key);
  if (cached?.promise) return cached.promise;
  if (cached?.rows && cached.loadedAt && Date.now() - cached.loadedAt < DISPUTES_CACHE_TTL_MS) {
    return Promise.resolve(cached.rows);
  }

  const promise = dbService.getMyBookingDisputes().then((rows) => {
    disputesCache.set(key, { rows, loadedAt: Date.now() });
    return rows;
  }).catch((error) => {
    disputesCache.delete(key);
    throw error;
  });
  disputesCache.set(key, { promise });
  return promise;
}

const reasons: Array<{ value: BookingDisputeReason; label: string }> = [
  { value: 'PROVIDER_NO_SHOW', label: 'Instrutor não compareceu' },
  { value: 'STUDENT_NO_SHOW', label: 'Aluno não compareceu' },
  { value: 'LESSON_NOT_DELIVERED', label: 'A aula não aconteceu' },
  { value: 'TIME_MISMATCH', label: 'Horário ou duração divergente' },
  { value: 'MEETING_POINT_MISMATCH', label: 'Local de encontro divergente' },
  { value: 'SERVICE_MISMATCH', label: 'Instrutor ou veículo diferente' },
  { value: 'SAFETY_CONCERN', label: 'Problema de segurança' },
  { value: 'OTHER', label: 'Outro motivo' },
];

export const BookingDisputePanel: React.FC<{ booking: Booking; currentUserId?: string; display?: 'section' | 'action' }> = ({ booking, currentUserId, display = 'section' }) => {
  const [disputes, setDisputes] = useState<BookingDispute[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [reasonCode, setReasonCode] = useState<BookingDisputeReason>('LESSON_NOT_DELIVERED');
  const [description, setDescription] = useState('');
  const [response, setResponse] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [evidence, setEvidence] = useState<BookingDisputeEvidence[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDispute = useMemo(() => disputes.find((item) => item.bookingId === booking.id && ['OPEN', 'AWAITING_STUDENT_RESPONSE', 'AWAITING_PROVIDER_RESPONSE', 'UNDER_REVIEW'].includes(item.status)), [booking.id, disputes]);

  useEffect(() => {
    if ((import.meta as any).env?.MODE === 'test') return undefined;
    let active = true;
    void getCachedBookingDisputes(currentUserId)
      .then((rows) => { if (active) setDisputes(rows); })
      .catch(() => undefined)
      .finally(() => undefined);
    return () => { active = false; };
  }, [booking.id, currentUserId, reloadKey]);

  useEffect(() => {
    const reload = () => {
      clearDisputesCache(currentUserId);
      setReloadKey((current) => current + 1);
    };
    window.addEventListener('mazzi:dispute-updated', reload);
    return () => window.removeEventListener('mazzi:dispute-updated', reload);
  }, [currentUserId]);

  const notifyDisputeUpdated = () => window.dispatchEvent(new CustomEvent('mazzi:dispute-updated'));

  useEffect(() => {
    if (!activeDispute || (import.meta as any).env?.MODE === 'test') {
      setEvidence([]);
      setEvidenceError(null);
      return undefined;
    }
    let active = true;
    setIsLoadingEvidence(true);
    setEvidenceError(null);
    void dbService.getBookingDisputeEvidence(activeDispute.id)
      .then((rows) => { if (active) setEvidence(rows); })
      .catch((cause) => { if (active) setEvidenceError(mapFriendlyErrorMessage(cause, 'Não foi possível carregar os arquivos da contestação.')); })
      .finally(() => { if (active) setIsLoadingEvidence(false); });
    return () => { active = false; };
  }, [activeDispute?.id]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const incoming = Array.from(files);
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const invalid = incoming.find((file) => !allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid) {
      setError('Envie imagens JPG, PNG ou WEBP, ou arquivos PDF, com até 10 MB cada.');
      return;
    }
    setPendingFiles((current) => [...current, ...incoming].slice(0, 10));
  };

  const uploadPendingFiles = async (disputeId: string) => {
    const uploaded: BookingDisputeEvidence[] = [];
    for (const file of pendingFiles) uploaded.push(await dbService.uploadBookingDisputeEvidence(disputeId, file));
    if (uploaded.length) setEvidence((current) => [...current, ...uploaded]);
    setPendingFiles([]);
  };

  const openDispute = async () => {
    setIsSaving(true); setError(null);
    try {
      const created = await dbService.openBookingDispute({ bookingId: booking.id, reasonCode, description });
      setDisputes((current) => [created, ...current]);
      await uploadPendingFiles(created.id);
      setIsOpening(false); setDescription('');
      notifyDisputeUpdated();
    } catch (cause) { setError(mapFriendlyErrorMessage(cause, 'Não foi possível abrir a contestação. Verifique se o prazo ainda está ativo.')); }
    finally { setIsSaving(false); }
  };

  const closeOpeningScreen = () => {
    if (isSaving) return;
    setIsOpening(false);
    setError(null);
  };

  const respond = async () => {
    if (!activeDispute) return;
    setIsSaving(true); setError(null);
    try {
      await uploadPendingFiles(activeDispute.id);
      const updated = await dbService.respondBookingDispute(activeDispute.id, response);
      setDisputes((current) => current.map((item) => item.id === updated.id ? updated : item));
      setResponse('');
      notifyDisputeUpdated();
    } catch (cause) { setError(mapFriendlyErrorMessage(cause, 'Não foi possível enviar a resposta.')); }
    finally { setIsSaving(false); }
  };


  const openEvidence = async (item: BookingDisputeEvidence) => {
    try {
      const url = await dbService.getBookingDisputeEvidenceUrl(item.storagePath);
      // Generate the signed URL before opening the tab, so the new tab never
      // lands on an intermediate about:blank page.
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.assign(url);
    } catch (cause) {
      setError(mapFriendlyErrorMessage(cause, 'Não foi possível abrir o arquivo.'));
    }
  };

  const filePicker = (
    <div className="space-y-2">
      <label htmlFor={`dispute-files-${booking.id}`} className="block text-sm font-extrabold text-slate-900">Arquivos de comprovação <span className="font-medium text-slate-500">(opcional)</span></label>
      <label htmlFor={`dispute-files-${booking.id}`} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-amber-400 hover:bg-amber-50">
        <Paperclip className="h-4 w-4" aria-hidden="true" />Selecionar imagens ou PDF
      </label>
      <input id={`dispute-files-${booking.id}`} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
      <p className="text-xs leading-5 text-slate-500">Até 10 arquivos por pessoa, com no máximo 10 MB cada.</p>
      {pendingFiles.length > 0 && <ul className="space-y-2" aria-label="Arquivos selecionados">{pendingFiles.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"><FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{file.name}</span><ButtonBase className="grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label={`Remover ${file.name}`} onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-4 w-4" aria-hidden="true" /></ButtonBase></li>)}</ul>}
    </div>
  );

  if (activeDispute) {
    const openedByMe = activeDispute.openedBy === currentUserId;
    const isStudent = currentUserId === booking.studentId;
    // The opener may attach evidence only while opening the dispute. After that,
    // new evidence is accepted only from the other party while they can respond.
    const waitingForMe = isStudent
      ? activeDispute.status === 'AWAITING_STUDENT_RESPONSE'
      : activeDispute.status === 'AWAITING_PROVIDER_RESPONSE';
    const canRespond = ['OPEN', 'AWAITING_STUDENT_RESPONSE', 'AWAITING_PROVIDER_RESPONSE'].includes(activeDispute.status)
      && (activeDispute.status === 'OPEN' ? !openedByMe : waitingForMe);
    const responseStatusLabel = activeDispute.status === 'AWAITING_STUDENT_RESPONSE'
      ? isStudent ? 'Aguardando sua resposta' : 'Aguardando resposta do aluno'
      : activeDispute.status === 'AWAITING_PROVIDER_RESPONSE'
        ? isStudent ? 'Aguardando resposta do PRO' : 'Aguardando sua resposta'
        : 'Contestação em análise';
    const contestContent = (
      <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label="Contestação da reserva">
        <div className="flex items-start gap-2"><MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="text-xs font-black text-amber-950">{responseStatusLabel}</p><p className="text-[11px] font-medium text-amber-800">{isStudent ? 'Seu pagamento está seguro durante a contestação.' : 'O repasse está bloqueado até a resolução da contestação.'}</p>{canRespond && <p className="mt-1 text-[11px] font-bold text-amber-900">Você deve responder até {new Date(activeDispute.responseDueAt).toLocaleString('pt-BR')}. Após esse prazo, a contestação será finalizada.</p>}</div></div>
        <p className="text-xs font-semibold text-slate-800">{reasons.find((item) => item.value === activeDispute.reasonCode)?.label}</p>
        {activeDispute.informationRequest && <p className="rounded-xl border border-amber-200 bg-white p-3 text-xs font-semibold text-amber-900"><strong>Informações solicitadas:</strong> {activeDispute.informationRequest}</p>}
        {activeDispute.messages && activeDispute.messages.length > 0 ? <div className="space-y-2" aria-label="Mensagens da contestação"><p className="text-[10px] font-black uppercase text-slate-500">Mensagens da contestação</p>{activeDispute.messages.map((message) => <div key={message.id} className="rounded-xl bg-white/80 p-3"><div className="mb-1 flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase text-slate-400">{message.type === 'DESCRIPTION' ? 'Relato da contestação' : message.type === 'INFORMATION_REQUEST' ? 'Solicitação do Admin' : 'Resposta'}</p><time className="text-[10px] font-semibold text-slate-400">{new Date(message.createdAt).toLocaleString('pt-BR')}</time></div><p className="mb-1 text-[11px] font-bold text-slate-600">{message.authorRole === 'ADMIN' ? 'Admin' : message.authorRole === 'STUDENT' ? 'Aluno' : 'PRO'}</p><p className="text-xs text-slate-700">{message.content}</p></div>)}</div> : <p className="rounded-xl bg-white/80 p-3 text-xs text-slate-700">{activeDispute.description}</p>}
        {(isLoadingEvidence || evidence.length > 0 || evidenceError) && <div className="space-y-2 rounded-xl border border-amber-200 bg-white/60 p-3"><p className="text-[10px] font-black uppercase text-slate-500">Arquivos enviados</p>{isLoadingEvidence && <p className="text-xs font-semibold text-slate-500">Carregando arquivos...</p>}{evidence.length > 0 && <ul className="space-y-2">{evidence.map((item) => <li key={item.id}><ButtonBase onClick={() => void openEvidence(item)} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-amber-100 bg-white p-3 text-left"><FileText className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{item.originalName}</span><span className="text-[10px] font-semibold text-slate-500">{item.uploadedBy === currentUserId ? 'Você' : 'Outra parte'}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" /></ButtonBase></li>)}</ul>}{evidenceError && <p role="alert" className="text-xs font-bold text-rose-700">{evidenceError}</p>}</div>}
        {canRespond && filePicker}
        {canRespond && <div className="space-y-2"><Textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={3} maxLength={4000} placeholder="Conte sua versão dos fatos..." /><Button type="button" size="sm" className="w-full" disabled={response.trim().length < 10} isLoading={isSaving} onClick={respond} leftIcon={<Send className="h-4 w-4" />}>Enviar resposta e arquivos</Button></div>}
        {activeDispute.status === 'UNDER_REVIEW' && <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800"><CheckCircle2 className="h-3.5 w-3.5" />As duas versões foram registradas. A equipe MAZZI fará a análise.</p>}
        {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
      </section>
    );
    if (display === 'section') return null;
    return (
      <>
        <Button type="button" variant="dangerSoft" size="sm" className="min-w-0 flex-1" onClick={() => setIsViewing(true)} leftIcon={<MessageSquareWarning className="h-4 w-4" aria-hidden="true" />}>Ver contestação</Button>
        <Modal id={`view-booking-dispute-${booking.id}`} isOpen={isViewing} onClose={() => setIsViewing(false)} title="Contestação" presentation="page" layer="nested" portal closeOnBackdrop={false}>
          <div className="pb-6">{contestContent}</div>
        </Modal>
      </>
    );
  }

  if (display === 'action') {
    return null;
  }

  if (booking.status !== 'COMPLETED') return null;

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <Button type="button" variant="dangerSoft" size="sm" className="min-h-11 w-full" onClick={() => setIsOpening(true)} leftIcon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}>Informar problema com a aula</Button>
      </section>

      <Modal
        id={`open-booking-dispute-${booking.id}`}
        isOpen={isOpening}
        onClose={closeOpeningScreen}
        title="Abrir contestação"
        presentation="page"
        layer="nested"
        portal
        closeOnBackdrop={false}
        footer={(
          <Button
            type="button"
            className="min-h-12 w-full"
            disabled={description.trim().length < 10}
            isLoading={isSaving}
            onClick={openDispute}
          >
            Enviar contestação
          </Button>
        )}
      >
        <div className="space-y-6 pb-4">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label="Informação importante">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-black text-amber-950">Conte o que aconteceu</p>
                <p className="mt-1 text-sm leading-5 text-amber-900">Se a contestação estiver dentro do prazo configurado, {currentUserId === booking.studentId ? 'seu pagamento permanecerá seguro durante a análise.' : 'o repasse ao profissional ficará bloqueado até a análise.'}</p>
              </div>
            </div>
          </section>

          <div className="space-y-2">
            <label htmlFor={`dispute-reason-${booking.id}`} className="block text-sm font-extrabold text-slate-900">Motivo da contestação</label>
            <Select id={`dispute-reason-${booking.id}`} value={reasonCode} onChange={(event) => setReasonCode(event.target.value as BookingDisputeReason)} options={reasons} />
          </div>

          {filePicker}

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <label htmlFor={`dispute-description-${booking.id}`} className="block text-sm font-extrabold text-slate-900">Descreva o problema</label>
              <span className="text-xs font-semibold tabular-nums text-slate-500">{description.length}/4000</span>
            </div>
            <Textarea
              id={`dispute-description-${booking.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={7}
              maxLength={4000}
              placeholder="Explique com detalhes o que aconteceu durante a aula."
              aria-describedby={`dispute-description-help-${booking.id}`}
            />
            <p id={`dispute-description-help-${booking.id}`} className="text-xs leading-5 text-slate-500">Informe pelo menos 10 caracteres. Você poderá acompanhar a análise nos detalhes desta reserva.</p>
          </div>

          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        </div>
      </Modal>
    </>
  );
};
