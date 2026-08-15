// ============================================================================
// MAZZI DOMAIN — PAYMENT WEBHOOK RECEIVER & HANDLER SERVICE (SPRINT 09)
// ============================================================================

import {
  Booking,
  Payment,
  PaymentWebhookEvent,
  WebhookEventStatus,
} from '../../types';
import { PaymentGateway, ParsedWebhookEvent } from './gateway-interface';
import { PaymentService } from './payment-service';

export interface WebhookProcessResult {
  status: 'PROCESSED' | 'IGNORED' | 'REPLAY' | 'ERROR';
  eventRecord: PaymentWebhookEvent;
  booking?: Booking;
  payment?: Payment;
  message?: string;
}

export class PaymentWebhookService {
  private processedEvents = new Map<string, PaymentWebhookEvent>();

  constructor(
    private gateway: PaymentGateway,
    private paymentService: PaymentService
  ) {}

  /**
   * Main entrypoint for processing raw webhook requests received from PSP.
   * Handles signature authentication, deduplication, monotonic state transitions, and idempotency.
   */
  async processWebhook(params: {
    rawPayload: string | Buffer;
    headers: Record<string, string | string[] | undefined>;
    existingPayments: Payment[];
    existingBookings: Booking[];
    revalidateWithGateway?: boolean;
    now?: Date;
  }): Promise<WebhookProcessResult> {
    const { rawPayload, headers, existingPayments, existingBookings, revalidateWithGateway } = params;
    const now = params.now || new Date();

    // 1. Cryptographic Signature Verification
    const isSignatureValid = this.gateway.verifyWebhookSignature(rawPayload, headers);
    if (!isSignatureValid) {
      throw new Error('Falha na autenticação da assinatura do webhook (UNAUTHORIZED).');
    }

    // 2. Parse Payload
    const parsedEvent: ParsedWebhookEvent = this.gateway.parseWebhookPayload(rawPayload, headers);
    const eventKey = `${parsedEvent.gateway}:${parsedEvent.externalEventId}`;

    // Authoritative PSP Revalidation when requested
    if (revalidateWithGateway && parsedEvent.externalPaymentId) {
      try {
        const authoritativeDetails = await this.gateway.getPayment(parsedEvent.externalPaymentId);
        if (authoritativeDetails.status) {
          parsedEvent.mappedStatus = authoritativeDetails.status;
          parsedEvent.paidAt = authoritativeDetails.paidAt || parsedEvent.paidAt;
        }
      } catch (err: any) {
        // Fall back to parsed payload if gateway query is unreachable
      }
    }

    // 3. Replay Protection: Check if this exact externalEventId has already been processed
    const existingEvent = this.processedEvents.get(eventKey);
    if (existingEvent && existingEvent.status === 'PROCESSED') {
      return {
        status: 'REPLAY',
        eventRecord: existingEvent,
        message: 'Evento já processado anteriormente (idempotent ACK).',
      };
    }

    // Initialize Event Record
    const eventRecord: PaymentWebhookEvent = {
      id: `evt_rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      gateway: parsedEvent.gateway,
      externalEventId: parsedEvent.externalEventId,
      externalPaymentId: parsedEvent.externalPaymentId,
      eventType: parsedEvent.eventType,
      status: 'RECEIVED',
      receivedAt: now.toISOString(),
    };

    // 4. Find Associated Payment
    const payment = existingPayments.find(
      (p) =>
        p.externalPaymentId === parsedEvent.externalPaymentId ||
        p.id === parsedEvent.externalPaymentId ||
        p.idempotencyKey === parsedEvent.rawPayload?.metadata?.idempotency_key
    );

    if (!payment) {
      eventRecord.status = 'IGNORED';
      eventRecord.errorMessage = `Nenhum pagamento correspondente encontrado para externalPaymentId: ${parsedEvent.externalPaymentId}`;
      eventRecord.processedAt = now.toISOString();
      this.processedEvents.set(eventKey, eventRecord);

      return {
        status: 'IGNORED',
        eventRecord,
        message: eventRecord.errorMessage,
      };
    }

    // 5. Find Associated Booking
    const booking = existingBookings.find((b) => b.id === payment.bookingId);
    if (!booking) {
      eventRecord.status = 'FAILED';
      eventRecord.errorMessage = `Reserva ${payment.bookingId} associada ao pagamento não encontrada.`;
      eventRecord.processedAt = now.toISOString();
      this.processedEvents.set(eventKey, eventRecord);

      return {
        status: 'ERROR',
        eventRecord,
        message: eventRecord.errorMessage,
      };
    }

    // 6. Monotonic State Transition / Out-of-order Event Protection
    // If the payment is already PAID, a late "PENDING" or "IN_PROCESS" webhook MUST NOT downgrade it.
    if (payment.status === 'PAID' && parsedEvent.mappedStatus === 'PENDING') {
      eventRecord.status = 'IGNORED';
      eventRecord.processedAt = now.toISOString();
      this.processedEvents.set(eventKey, eventRecord);

      return {
        status: 'IGNORED',
        eventRecord,
        booking,
        payment,
        message: 'Evento fora de ordem ignorado (pagamento já está PAID).',
      };
    }

    // 7. Route according to mapped status
    try {
      if (parsedEvent.mappedStatus === 'PAID' || parsedEvent.mappedStatus === 'AUTHORIZED') {
        const confirmResult = await this.paymentService.confirmBookingPayment({
          payment,
          booking,
          externalPaymentId: parsedEvent.externalPaymentId,
          paidAt: parsedEvent.paidAt || now.toISOString(),
          now,
        });

        eventRecord.status = 'PROCESSED';
        eventRecord.processedAt = now.toISOString();
        this.processedEvents.set(eventKey, eventRecord);

        return {
          status: 'PROCESSED',
          eventRecord,
          booking: confirmResult.booking,
          payment: confirmResult.payment,
        };
      }

      if (parsedEvent.mappedStatus === 'FAILED' || parsedEvent.mappedStatus === 'CANCELLED') {
        const failResult = await this.paymentService.handlePaymentFailure({
          payment,
          booking,
          reason: parsedEvent.failureReason || 'Rejeitado pelo emissor/gateway',
          now,
        });

        eventRecord.status = 'PROCESSED';
        eventRecord.processedAt = now.toISOString();
        this.processedEvents.set(eventKey, eventRecord);

        return {
          status: 'PROCESSED',
          eventRecord,
          booking: failResult.booking,
          payment: failResult.payment,
        };
      }

      // Default ignore unhandled intermediate statuses
      eventRecord.status = 'IGNORED';
      eventRecord.processedAt = now.toISOString();
      this.processedEvents.set(eventKey, eventRecord);

      return {
        status: 'IGNORED',
        eventRecord,
        booking,
        payment,
      };
    } catch (err: any) {
      eventRecord.status = 'FAILED';
      eventRecord.errorMessage = err.message || 'Erro inesperado no processamento do webhook.';
      eventRecord.processedAt = now.toISOString();
      this.processedEvents.set(eventKey, eventRecord);

      return {
        status: 'ERROR',
        eventRecord,
        message: eventRecord.errorMessage,
      };
    }
  }

  getProcessedEvent(eventKey: string): PaymentWebhookEvent | undefined {
    return this.processedEvents.get(eventKey);
  }
}
