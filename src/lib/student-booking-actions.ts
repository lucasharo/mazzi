import { Booking } from '../types';
import { dbService as defaultDbService } from './db-service';
import type { CheckInLocation } from './checkin-location';

export interface StudentBookingService {
  studentCheckInBooking(bookingId: string, location: CheckInLocation): Promise<any>;
  getBookings(): Promise<Booking[]>;
}

export async function studentCheckInAndRehydrateBooking(
  bookingId: string,
  location: CheckInLocation,
  service: StudentBookingService = defaultDbService
): Promise<{ bookings: Booking[]; updatedBooking: Booking }> {
  await service.studentCheckInBooking(bookingId, location);
  const bookings = await service.getBookings();
  const updatedBooking = bookings.find((b) => b.id === bookingId);

  if (!updatedBooking) {
    throw new Error('BOOKING_NOT_FOUND_AFTER_CHECKIN: O agendamento não foi localizado na reidratação autoritativa do servidor.');
  }

  return {
    bookings,
    updatedBooking,
  };
}
