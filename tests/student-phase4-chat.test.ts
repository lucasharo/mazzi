import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeMessagesById } from '../src/lib/chat-messages';
import { Message } from '../src/types';

const root = process.cwd();
const student = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const panel = readFileSync(join(root, 'src/components/chat/BookingChatPanel.tsx'), 'utf8');

const message = (id: string, createdAt: string, content = id): Message => ({
  id, conversationId: 'conversation-1', senderId: 'sender-1', content, isRead: false, createdAt,
});

describe('Student new template phase 4 chat contracts', () => {
  it('deduplicates and deterministically orders initial, realtime, polling and send messages', () => {
    const result = mergeMessagesById(
      [message('two', '2026-08-24T10:02:00Z'), message('one', '2026-08-24T10:01:00Z')],
      [message('two', '2026-08-24T10:02:00Z', 'updated'), message('three', '2026-08-24T10:03:00Z')],
    );
    expect(result.map((item) => item.id)).toEqual(['one', 'two', 'three']);
    expect(result[1].content).toBe('updated');
  });

  it('keeps chat access booking-scoped through bookings without standalone chats tab', () => {
    expect(student).not.toContain("{ id: 'messages', label: 'Chat'");
    expect(student).toContain('onOpenChat');
    expect(student).toContain('selectedBookingForChat');
    expect(student).toContain('BookingChatPanel');
  });

  it('preserves realtime, polling fallback, reconnect refetch and cleanup', () => {
    expect(panel).toContain("table: 'messages'");
    expect(panel).toContain("event: 'INSERT'");
    expect(panel).toContain('conversation_id=eq.${conversation.id}');
    expect(panel).toContain('setInterval(poll, 10000)');
    expect(panel).toContain('getMessagesForConversation(conversation.id)');
    expect(panel).toContain('supabase.removeChannel(channel)');
    expect(panel).toContain('mergeMessagesById');
    expect(panel).not.toContain('setMessages((prev) => [...prev, newMessage])');
  });

  it('keeps chat text-only and does not add unread/read or presence behavior', () => {
    expect(panel).toContain('maxLength={2000}');
    expect(panel).toContain('aria-label="Mensagem"');
    expect(panel).toContain('Não foi possível carregar esta conversa.');
    expect(panel).toContain('Não foi possível enviar a mensagem.');
    expect(panel).not.toContain('is_read = true');
    expect(panel).not.toContain('online');
    expect(panel).not.toContain('dangerouslySetInnerHTML');
  });
});
