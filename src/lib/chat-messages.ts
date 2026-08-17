import { Message } from '../types';

/** Merge messages from initial load, realtime, polling and send responses safely. */
export function mergeMessagesById(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();
  [...current, ...incoming].forEach((message) => byId.set(message.id, message));
  return Array.from(byId.values()).sort((a, b) => {
    const order = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return order || a.id.localeCompare(b.id);
  });
}
