import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, SendHorizontal, Calendar, Clock, Car, Radio, ArrowLeft } from 'lucide-react';
import { Booking, Conversation, Message } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { Button, ButtonBase } from '../ui/Button';
import { dbService, mapMessageFromDb } from '../../lib/db-service';
import { supabase } from '../../lib/supabase';
import { formatDateBR, formatTimeBR } from '../../lib/date-format';
import { mergeMessagesById } from '../../lib/chat-messages';
import { StatusBadge } from '../ui/StatusBadge';
import { Textarea } from '../ui/Textarea';

interface BookingChatPanelProps {
  booking: Booking;
  onBack?: () => void;
}

export const BookingChatPanel: React.FC<BookingChatPanelProps> = ({ booking, onBack }) => {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initialPositionedRef = useRef(false);
  const conversationLoadInFlightRef = useRef<Promise<void> | null>(null);
  const messagesLoadInFlightRef = useRef<{ conversationId: string; promise: Promise<Message[]> } | null>(null);
  const messagesCacheRef = useRef<{ conversationId: string; messages: Message[]; loadedAt: number } | null>(null);

  const currentUserId = user?.id;
  const isStudent = user?.role === 'STUDENT' || Boolean(user?.roles?.includes('STUDENT'));
  const isPaymentNotCompleted = booking.status === 'EXPIRED'
    || booking.status === 'PAYMENT_FAILED'
    || (booking.status === 'PENDING_PAYMENT' && Boolean(booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() <= Date.now()));
  const chatBlockedForStudent = isStudent && isPaymentNotCompleted;
  const chatBlockedForContestation = booking.status === 'DISPUTED';
  const chatBlockedForSending = chatBlockedForStudent || chatBlockedForContestation;

  const title = useMemo(() => booking.instructorName || booking.providerName || 'Aula MAZZI', [booking.instructorName, booking.providerName]);
  const provider = booking.providerName && booking.providerName !== booking.instructorName ? booking.providerName : '';
  const start = booking.scheduledStartAt || `${booking.scheduledDate}T${booking.startTime}:00`;
  const end = booking.scheduledEndAt || `${booking.scheduledDate}T${booking.endTime}:00`;
  const vehicle = booking.vehicleName || booking.snapshot?.vehicleName;

  const loadMessages = useCallback(async (conversationId: string, force = false): Promise<Message[]> => {
    const cached = messagesCacheRef.current;
    if (!force && cached?.conversationId === conversationId && Date.now() - cached.loadedAt < 2_000) {
      return cached.messages;
    }
    const inFlight = messagesLoadInFlightRef.current;
    if (inFlight?.conversationId === conversationId) return inFlight.promise;

    const request = dbService.getMessagesForConversation(conversationId);
    messagesLoadInFlightRef.current = { conversationId, promise: request };
    void request.then(
      (rows) => {
        messagesCacheRef.current = { conversationId, messages: rows, loadedAt: Date.now() };
        if (messagesLoadInFlightRef.current?.promise === request) messagesLoadInFlightRef.current = null;
      },
      () => {
        if (messagesLoadInFlightRef.current?.promise === request) messagesLoadInFlightRef.current = null;
      },
    );
    return request;
  }, []);

  const loadConversation = useCallback(async () => {
    if (conversationLoadInFlightRef.current) return conversationLoadInFlightRef.current;

    const request = (async () => {
    setLoading(true);
    setError(null);
    if (chatBlockedForStudent) {
      setConversation(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      const convo = await dbService.getConversationForBooking(booking.id);
      const convoMessages = await loadMessages(convo.id, true);
      setConversation(convo);
      setMessages(mergeMessagesById([], convoMessages));
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to load booking chat:', err);
      setError('Não foi possível carregar esta conversa.');
      setConversation(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
    })();

    conversationLoadInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (conversationLoadInFlightRef.current === request) conversationLoadInFlightRef.current = null;
    }
  }, [booking.id, chatBlockedForStudent, loadMessages]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!conversation?.id) return;
    let disposed = false;
    let channel: any;
    let pollingInterval: number | undefined;
    let lastRealtimeHealthy = false;

    const mergeMessages = (incoming: Message[]) => setMessages((current) => mergeMessagesById(current, incoming));
    const poll = () => {
      if (disposed || lastRealtimeHealthy) return;
      void loadMessages(conversation.id).then(mergeMessages).catch(() => undefined);
    };

    channel = supabase
      .channel(`booking-chat:${conversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` }, (payload: any) => {
        mergeMessages([mapMessageFromDb(payload.new)]);
      })
      .subscribe((status: string) => {
        const healthy = status === 'SUBSCRIBED';
        setRealtimeReady(healthy);
        if (healthy && !lastRealtimeHealthy) {
          void loadMessages(conversation.id).then(mergeMessages).catch(() => undefined);
        }
        lastRealtimeHealthy = healthy;
        if (!healthy && pollingInterval === undefined) {
          void poll();
          pollingInterval = window.setInterval(poll, 10000);
        }
        if (healthy && pollingInterval !== undefined) { window.clearInterval(pollingInterval); pollingInterval = undefined; }
      });

    const handleVisibility = () => {
      if (!document.hidden) void loadMessages(conversation.id, true).then(mergeMessages).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      if (pollingInterval !== undefined) window.clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
      setRealtimeReady(false);
    };
  }, [conversation?.id, loadMessages]);

  useEffect(() => {
    initialPositionedRef.current = false;
  }, [conversation?.id]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (!messages.length) return;
    if (!initialPositionedRef.current) {
      initialPositionedRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (nearBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (chatBlockedForSending || !conversation || !body || sending) return;

    setSending(true);
    setError(null);
    try {
      const newMessage = await dbService.sendMessage(conversation.id, body);
      setMessages((prev) => mergeMessagesById(prev, [newMessage]));
      setDraft('');
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to send booking chat message:', err);
      setError('Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col space-y-3 text-left">
      <div className="mazzi-card border border-[var(--mazzi-border)] p-3">
        {onBack && (
          <ButtonBase
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-2xs transition-colors hover:bg-slate-200 hover:text-slate-950 active:scale-95"
            aria-label="Voltar para os detalhes da aula"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Voltar aos detalhes</span>
          </ButtonBase>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-600">Conversa da aula</p>
            <h4 className="mt-1 truncate text-base font-extrabold text-[var(--mazzi-dark)]">{title}</h4>
            {provider && <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{provider}</p>}
          </div>
          <StatusBadge status={booking.status} audience="student" instructorCheckedIn={Boolean(booking.instructorCheckedIn)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            {formatDateBR(start)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {formatTimeBR(start)}{end ? `–${formatTimeBR(end)}` : ''}
          </span>
          {vehicle && (
            <span className="inline-flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {vehicle}
            </span>
          )}
        </div>
      </div>

      {realtimeReady && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-emerald-600">
          <Radio className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          Atualização em tempo real
        </p>
      )}
      {!realtimeReady && !loading && conversation && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-amber-700">
          <Radio className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
          Reconectando…
        </p>
      )}

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-rose-700"
              onClick={loadConversation}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} aria-live="polite" aria-busy={loading} className="mazzi-card min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain border border-[var(--mazzi-border)] p-3">
        {loading ? (
          <div aria-hidden="true" className="space-y-3 p-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className={`h-12 animate-pulse rounded-2xl bg-slate-100 ${item % 2 ? 'w-3/4' : 'ml-auto w-2/3'}`} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 px-6">
            Nenhuma mensagem ainda. Use este chat para combinar detalhes da aula agendada.
          </div>
        ) : (
          messages.map((message, index) => {
            const isMine = message.senderId === currentUserId;
            const previous = messages[index - 1];
            const showDateSeparator = !previous || formatDateBR(previous.createdAt) !== formatDateBR(message.createdAt);
            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <div className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {formatDateBR(message.createdAt)}
                  </div>
                )}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs ${
                      isMine
                        ? 'rounded-br-xs bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-medium shadow-2xs'
                        : 'rounded-bl-xs bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-text)] border border-[var(--mazzi-border)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p className={`text-[10px] mt-1 text-right font-medium ${isMine ? 'text-amber-950/70' : 'text-slate-400'}`}>
                      {formatTimeBR(message.createdAt)}
                    </p>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Read-Only Notice for Cancelled Bookings */}
      {(booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER') && (
        <div role="status" className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
          <span>Esta aula foi cancelada. O histórico de mensagens permanece preservado para consulta.</span>
        </div>
      )}

      {chatBlockedForStudent && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>Pagamento não realizado. A conversa fica indisponível para esta reserva.</span>
        </div>
      )}

      {chatBlockedForContestation && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>O chat está bloqueado enquanto a contestação estiver em análise. Use a tela da contestação para responder.</span>
        </div>
      )}

      {/* Modern Integrated Composer */}
      {!chatBlockedForSending && <div className="shrink-0 space-y-1.5 pb-[env(safe-area-inset-bottom)]">
        <div className="relative flex min-h-14 items-center rounded-2xl bg-white border border-[var(--mazzi-border)] focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-[var(--mazzi-focus-glow)] transition-all shadow-xs">
          <Textarea
            aria-label="Mensagem"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={1}
            maxLength={2000}
            className="!h-14 !min-h-14 w-full resize-none !border-0 bg-transparent px-4 py-3.5 pr-16 text-xs leading-relaxed text-[var(--mazzi-text)] placeholder:text-slate-400 focus:!border-0 focus:outline-none focus:!ring-0 disabled:cursor-not-allowed disabled:bg-slate-50 sm:text-sm"
            placeholder={booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER' ? 'Chat encerrado por cancelamento da aula.' : 'Escreva uma mensagem sobre esta aula...'}
            disabled={!conversation || loading || sending || chatBlockedForSending || booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER'}
          />
          <ButtonBase
            type="button"
            onClick={handleSend}
            disabled={!conversation || loading || sending || chatBlockedForSending || !draft.trim() || booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER'}
            aria-label="Enviar mensagem"
            title="Enviar mensagem"
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 shrink-0 items-center justify-center rounded-xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs transition hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)]"
          >
            {sending ? (
              <RefreshCw className="h-4 w-4 animate-spin text-current" aria-hidden="true" />
            ) : (
              <SendHorizontal className="h-4 w-4 text-current" aria-hidden="true" />
            )}
          </ButtonBase>
        </div>
      </div>}
    </div>
  );
};
