import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, Send, Calendar, Clock, Car, Radio } from 'lucide-react';
import { Booking, Conversation, Message } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/Button';
import { dbService, mapMessageFromDb } from '../../lib/db-service';
import { supabase } from '../../lib/supabase';
import { formatDateBR, formatTimeBR } from '../../lib/date-format';
import { mergeMessagesById } from '../../lib/chat-messages';
import { StatusBadge } from '../ui/StatusBadge';

interface BookingChatPanelProps {
  booking: Booking;
}

export const BookingChatPanel: React.FC<BookingChatPanelProps> = ({ booking }) => {
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

  const currentUserId = user?.id;

  const title = useMemo(() => booking.instructorName || booking.providerName || 'Aula MAZZI', [booking.instructorName, booking.providerName]);
  const provider = booking.providerName && booking.providerName !== booking.instructorName ? booking.providerName : '';
  const start = booking.scheduledStartAt || `${booking.scheduledDate}T${booking.startTime}:00`;
  const end = booking.scheduledEndAt || `${booking.scheduledDate}T${booking.endTime}:00`;
  const vehicle = booking.vehicleName || booking.snapshot?.vehicleName;

  const loadConversation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const convo = await dbService.getConversationForBooking(booking.id);
      const convoMessages = await dbService.getMessagesForConversation(convo.id);
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
  }, [booking.id]);

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
      void dbService.getMessagesForConversation(conversation.id).then(mergeMessages).catch(() => undefined);
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
          void dbService.getMessagesForConversation(conversation.id).then(mergeMessages).catch(() => undefined);
        }
        lastRealtimeHealthy = healthy;
        if (!healthy && pollingInterval === undefined) {
          void poll();
          pollingInterval = window.setInterval(poll, 10000);
        }
        if (healthy && pollingInterval !== undefined) { window.clearInterval(pollingInterval); pollingInterval = undefined; }
      });

    const handleVisibility = () => {
      if (!document.hidden) void dbService.getMessagesForConversation(conversation.id).then(mergeMessages).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      if (pollingInterval !== undefined) window.clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
      setRealtimeReady(false);
    };
  }, [conversation?.id]);

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
    if (!conversation || !body || sending) return;

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
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">Conversa da aula</p><h4 className="mt-1 truncate text-base font-black text-slate-950">{title}</h4>{provider && <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{provider}</p>}</div>
          <StatusBadge status={booking.status} audience="student" />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{formatDateBR(start)}</span><span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{formatTimeBR(start)}{end ? `–${formatTimeBR(end)}` : ''}</span>{vehicle && <span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{vehicle}</span>}</div>
      </div>

      {realtimeReady && <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-500"><Radio className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />Atualização em tempo real</p>}
      {!realtimeReady && !loading && conversation && <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-amber-700"><Radio className="h-3.5 w-3.5" aria-hidden="true" />Reconectando…</p>}

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

      <div ref={scrollContainerRef} aria-live="polite" aria-busy={loading} className="h-[min(55vh,28rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 space-y-2">
        {loading ? (
          <div aria-hidden="true" className="space-y-3 p-2">{[1, 2, 3].map((item) => <div key={item} className={`h-12 animate-pulse rounded-2xl bg-slate-100 ${item % 2 ? 'w-3/4' : 'ml-auto w-2/3'}`} />)}</div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 px-6">
            Nenhuma mensagem ainda. Use este chat apenas para combinar detalhes da aula já agendada.
          </div>
        ) : (
          messages.map((message, index) => {
            const isMine = message.senderId === currentUserId;
            const previous = messages[index - 1];
            const showDateSeparator = !previous || formatDateBR(previous.createdAt) !== formatDateBR(message.createdAt);
            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && <div className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">{formatDateBR(message.createdAt)}</div>}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs ${isMine ? 'bg-slate-950 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-slate-400' : 'text-slate-500'}`}>{formatTimeBR(message.createdAt)}</p>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <div className="flex items-end gap-2">
        <textarea
          aria-label="Mensagem"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          maxLength={2000}
          className="flex-1 rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-400 resize-none"
          placeholder="Escreva uma mensagem sobre esta aula..."
          disabled={!conversation || loading || sending}
          onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void handleSend(); } }}
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleSend}
          isLoading={sending}
          aria-label="Enviar mensagem"
          disabled={!conversation || loading || sending || !draft.trim()}
          leftIcon={<Send className="w-4 h-4" />}
        >
          Enviar
        </Button>
      </div>
      <p className="px-1 text-[10px] text-slate-400">Use Ctrl+Enter (ou Cmd+Enter) para enviar sem fechar o teclado.</p>
    </div>
  );
};
