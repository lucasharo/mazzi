import type { EmailProvider, EmailSendResult, SendEmailRequest } from './email-provider.ts';
import { buildEmailIdempotencyKey } from './email-references.ts';
import type { EmailTemplateName } from './email-types.ts';

export type EmailDeliveryStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface EmailDeliveryRecord {
  id: string;
  eventType: string;
  templateName: EmailTemplateName;
  recipientUserId: string;
  recipientEmail: string;
  appContext: string;
  businessEntityType: string;
  businessEntityId: string;
  idempotencyKey: string;
  status: EmailDeliveryStatus;
  attemptCount: number;
  provider?: string;
  providerMessageId?: string;
  lastError?: string;
}

export interface EmailDeliveryRepository {
  enqueue(input: Omit<EmailDeliveryRecord, 'id' | 'status' | 'attemptCount' | 'provider' | 'providerMessageId' | 'lastError'>): Promise<EmailDeliveryRecord>;
  claim(id: string): Promise<EmailDeliveryRecord | null>;
  retry(id: string): Promise<EmailDeliveryRecord | null>;
  markSent(id: string, result: EmailSendResult): Promise<void>;
  markFailed(id: string, error: unknown): Promise<void>;
}

export function getDeliveryIdempotencyKey(input: {
  eventType: string;
  templateName: EmailTemplateName;
  businessEntityId: string;
  recipientUserId: string;
}): string {
  return buildEmailIdempotencyKey(input);
}

export function normalizeDeliveryError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').slice(0, 1000);
}

export async function processEmailDelivery<T extends Record<string, string>>(options: {
  repository: EmailDeliveryRepository;
  provider: EmailProvider;
  deliveryId: string;
  subject: string;
  render: (templateName: EmailTemplateName, params: T) => Promise<string> | string;
  loadParams: (delivery: EmailDeliveryRecord) => Promise<T>;
}): Promise<{ status: 'SENT' | 'FAILED' | 'NOT_CLAIMED'; providerMessageId?: string }> {
  const delivery = await options.repository.claim(options.deliveryId);
  if (!delivery) return { status: 'NOT_CLAIMED' };

  try {
    const params = await options.loadParams(delivery);
    const html = await options.render(delivery.templateName, params);
    const request: SendEmailRequest = {
      to: delivery.recipientEmail,
      subject: options.subject,
      html,
      idempotencyKey: delivery.idempotencyKey,
    };
    const result = await options.provider.send(request);
    if (!result.accepted) throw new Error(result.reason || 'EMAIL_PROVIDER_NOT_ACCEPTED');
    await options.repository.markSent(delivery.id, result);
    return { status: 'SENT', providerMessageId: result.providerMessageId };
  } catch (error) {
    await options.repository.markFailed(delivery.id, error);
    return { status: 'FAILED' };
  }
}
