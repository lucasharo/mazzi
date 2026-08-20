import { Booking } from '../types';
import { dbService as defaultDbService } from './db-service';

export interface StudentBookingService {
  studentCheckInBooking(bookingId: string): Promise<any>;
  getBookings(): Promise<Booking[]>;
}

export async function studentCheckInAndRehydrateBooking(
  bookingId: string,
  service: StudentBookingService = defaultDbService
): Promise<{ bookings: Booking[]; updatedBooking: Booking }> {
  await service.studentCheckInBooking(bookingId);
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
