import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';
import { Booking, Conversation, Message } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/Button';
import { dbService } from '../../lib/db-service';

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

  const currentUserId = user?.id;

  const title = useMemo(() => {
    return booking.providerName || booking.instructorName || 'Aula MAZZI';
  }, [booking.providerName, booking.instructorName]);

  const loadConversation = async () => {
    setLoading(true);
    setError(null);
    try {
      const convo = await dbService.getConversationForBooking(booking.id);
      const convoMessages = await dbService.getMessagesForConversation(convo.id);
      setConversation(convo);
      setMessages(convoMessages);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar esta conversa.');
      setConversation(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConversation();
  }, [booking.id]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!conversation || !body || sending) return;

    setSending(true);
    setError(null);
    try {
      const newMessage = await dbService.sendMessage(conversation.id, body);
      setMessages((prev) => [...prev, newMessage]);
      setDraft('');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Conversa vinculada à reserva</p>
        <h4 className="font-black text-slate-900 text-sm mt-1">{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5">
          {booking.scheduledDate} • {booking.startTime}–{booking.endTime}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2">
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

      <div className="h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs font-bold text-slate-500">
            Carregando conversa...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 px-6">
            Nenhuma mensagem ainda. Use este chat apenas para combinar detalhes da aula já agendada.
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === currentUserId;
            return (
              <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs ${
                    isMine
                      ? 'bg-slate-950 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-slate-400' : 'text-slate-500'}`}>
                    {new Date(message.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          maxLength={2000}
          className="flex-1 rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-400 resize-none"
          placeholder="Escreva uma mensagem sobre esta aula..."
          disabled={!conversation || loading || sending}
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleSend}
          isLoading={sending}
          disabled={!conversation || !draft.trim()}
          leftIcon={<Send className="w-4 h-4" />}
        >
          Enviar
        </Button>
      </div>
    </div>
  );
};
