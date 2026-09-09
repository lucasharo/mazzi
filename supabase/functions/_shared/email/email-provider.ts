export interface SendEmailRequest {
  to: string | readonly string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export interface EmailSendResult {
  accepted: boolean;
  provider: 'noop' | 'resend';
  providerMessageId?: string;
  reason?: string;
}

export interface EmailProvider {
  send(request: SendEmailRequest): Promise<EmailSendResult>;
}

/**
 * Safe default until a real backend provider is explicitly implemented.
 * It performs no network request and never emits an email.
 */
export class NoopEmailProvider implements EmailProvider {
  async send(_request: SendEmailRequest): Promise<EmailSendResult> {
    return { accepted: false, provider: 'noop', reason: 'EMAIL_PROVIDER_NOT_IMPLEMENTED' };
  }
}

export class EmailProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = true) {
    super(message);
    this.name = 'EmailProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface ResendEmailProviderOptions {
  apiKey?: string;
  from?: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function normalizeRecipients(to: SendEmailRequest['to']): string[] {
  const recipients = Array.isArray(to) ? [...to] : [to];
  if (recipients.length === 0 || recipients.some((recipient) => typeof recipient !== 'string' || !recipient.trim())) {
    throw new EmailProviderError('EMAIL_RECIPIENT_REQUIRED', 'Destinatário de e-mail ausente.', false);
  }
  return recipients.map((recipient) => recipient.trim());
}

function normalizeProviderError(status: number, payload: unknown): EmailProviderError {
  const providerMessage = typeof payload === 'object' && payload !== null && 'message' in payload
    ? String((payload as { message?: unknown }).message || '')
    : '';
  const safeMessage = providerMessage.slice(0, 240);
  return new EmailProviderError(
    `RESEND_HTTP_${status}`,
    safeMessage ? `O provedor de e-mail recusou a mensagem: ${safeMessage}` : `O provedor de e-mail retornou HTTP ${status}.`,
    status === 408 || status === 425 || status === 429 || status >= 500,
  );
}

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ResendEmailProviderOptions = {}) {
    this.apiKey = (options.apiKey || '').trim();
    this.from = (options.from || '').trim();
    this.endpoint = (options.endpoint || 'https://api.resend.com/emails').trim();
    this.timeoutMs = Math.max(1000, Math.min(options.timeoutMs || 10000, 30000));
    this.fetchImpl = options.fetchImpl || fetch;

    if (!this.apiKey) throw new EmailProviderError('RESEND_API_KEY_MISSING', 'RESEND_API_KEY não configurada.', false);
    if (!this.from) throw new EmailProviderError('RESEND_FROM_MISSING', 'RESEND_FROM_EMAIL não configurado.', false);
  }

  async send(request: SendEmailRequest): Promise<EmailSendResult> {
    const recipients = normalizeRecipients(request.to);
    if (!request.subject.trim() || !request.html.trim()) {
      throw new EmailProviderError('EMAIL_CONTENT_REQUIRED', 'Assunto e HTML do e-mail são obrigatórios.', false);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: this.from,
          to: recipients,
          subject: request.subject,
          html: request.html,
          ...(request.text ? { text: request.text } : {}),
          ...(request.replyTo ? { reply_to: request.replyTo } : {}),
        }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw normalizeProviderError(response.status, payload);

      const providerMessageId = typeof payload?.id === 'string' ? payload.id.trim() : '';
      if (!providerMessageId) throw new EmailProviderError('RESEND_MESSAGE_ID_MISSING', 'O provedor não retornou o identificador da mensagem.', true);
      return { accepted: true, provider: 'resend', providerMessageId };
    } catch (error) {
      if (error instanceof EmailProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new EmailProviderError('RESEND_TIMEOUT', 'O provedor de e-mail excedeu o tempo limite.', true);
      }
      throw new EmailProviderError('RESEND_NETWORK_ERROR', 'Não foi possível alcançar o provedor de e-mail.', true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createEmailProvider(): EmailProvider {
  return new NoopEmailProvider();
}

export function createResendEmailProviderFromEnv(env: Record<string, string | undefined>): ResendEmailProvider {
  return new ResendEmailProvider({
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM_EMAIL,
  });
}
