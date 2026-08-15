// ============================================================================
// MAZZI DOMAIN — FINANCIAL LEDGER & AUDIT EVENT LOG (SPRINT 09)
// ============================================================================

import { FinancialEvent, FinancialEventType } from '../../types';

export interface CreateFinancialEventParams {
  eventType: FinancialEventType;
  bookingId?: string;
  paymentId?: string;
  providerId?: string;
  studentId?: string;
  amountInCents: number;
  platformFeeInCents?: number;
  providerAmountInCents?: number;
  metadata?: Record<string, any>;
}

export class FinancialLedgerService {
  private events: FinancialEvent[] = [];

  /**
   * Records an immutable financial event into the ledger.
   */
  recordEvent(params: CreateFinancialEventParams): FinancialEvent {
    const event: FinancialEvent = {
      id: `fin_evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      eventType: params.eventType,
      bookingId: params.bookingId,
      paymentId: params.paymentId,
      providerId: params.providerId,
      studentId: params.studentId,
      amountInCents: params.amountInCents,
      platformFeeInCents: params.platformFeeInCents || 0,
      providerAmountInCents: params.providerAmountInCents || 0,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString(),
    };

    this.events.push(event);
    return event;
  }

  getEventsByBookingId(bookingId: string): FinancialEvent[] {
    return this.events.filter((e) => e.bookingId === bookingId);
  }

  getEventsForBooking(bookingId: string): FinancialEvent[] {
    return this.getEventsByBookingId(bookingId);
  }

  getEventsByProviderId(providerId: string): FinancialEvent[] {
    return this.events.filter((e) => e.providerId === providerId);
  }

  getAllEvents(): FinancialEvent[] {
    return [...this.events];
  }
}

export const globalFinancialLedger = new FinancialLedgerService();
