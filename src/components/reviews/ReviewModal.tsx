import React, { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, MapPin, MessageSquareText } from 'lucide-react';
import { Booking, Review } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { dbService } from '../../lib/db-service';
import { formatDateBR, formatTimeBR } from '../../lib/date-format';
import { Rating } from '../ui/Rating';
import { Textarea } from '../ui/Textarea';
import { ProfileAvatar } from '../profile/ProfileAvatar';

interface ReviewModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: (review: Review) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSubmitted,
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !booking) return;

    setRating(0);
    setComment('');
    setExistingReview(null);
    setError(null);

    const loadExistingReview = async () => {
      setLoading(true);
      try {
        const review = await dbService.getReviewForBooking(booking.id);
        setExistingReview(review);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') console.error('Failed to load review:', err);
        setError('Não foi possível carregar a avaliação desta aula.');
      } finally {
        setLoading(false);
      }
    };

    void loadExistingReview();
  }, [isOpen, booking?.id]);

  const handleSubmit = async () => {
    if (!booking || submitting || existingReview) return;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError('Selecione uma nota de 1 a 5.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const review = await dbService.createReviewForBooking(booking.id, rating, comment);
      if (review.ratingOverall !== rating) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Review rating mismatch after submit:', { expected: rating, received: review.ratingOverall });
        }
        setError('Não foi possível confirmar a nota enviada. Atualize e tente novamente.');
        return;
      }
      setExistingReview(review);
      onSubmitted?.(review);
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to submit review:', err);
      setError('Não foi possível enviar sua avaliação.');
    } finally {
      setSubmitting(false);
    }
  };

  const footer = booking && !loading && !existingReview ? (
    <>
      <Button variant="outline" size="sm" onClick={onClose}>
        Fechar
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        isLoading={submitting}
        disabled={!['COMPLETED', 'DISPUTED'].includes(booking.status) || rating < 1 || rating > 5}
      >
        Enviar avaliação
      </Button>
    </>
  ) : undefined;

  const instructorName = booking?.instructorName || booking?.providerName || 'Instrutor';
  const bookingSnapshot = booking?.snapshot as (Booking['snapshot'] & {
    avatarUrl?: string;
    instructorAvatarUrl?: string;
    providerAvatarUrl?: string;
  }) | undefined;
  const instructorAvatarUrl = bookingSnapshot?.instructorAvatarUrl || bookingSnapshot?.avatarUrl || bookingSnapshot?.providerAvatarUrl;
  const lessonDate = booking?.scheduledStartAt ? formatDateBR(booking.scheduledStartAt) : booking ? formatDateBR(booking.scheduledDate) : '';
  const lessonTime = booking?.scheduledStartAt ? formatTimeBR(booking.scheduledStartAt) : booking ? `${booking.startTime}–${booking.endTime}` : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Avaliar aula concluída" size="md" footer={footer}>
      {!booking ? null : (
        <div className="space-y-5 text-sm">
          <section className="mazzi-compact-card overflow-hidden rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-5 text-center shadow-sm" aria-label="Resumo da aula">
            <ProfileAvatar name={instructorName} imageUrl={instructorAvatarUrl} size="xl" className="mx-auto h-24 w-24 text-2xl" />
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Sua aula</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--mazzi-dark)]">{instructorName}</h2>
            {booking.providerName !== booking.instructorName && <p className="mt-0.5 text-xs font-semibold text-slate-500">{booking.providerName}</p>}
            <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-2 text-left">
              <div className="flex min-h-11 items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700">
                <CalendarDays className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>{lessonDate}</span>
              </div>
              <div className="flex min-h-11 items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700">
                <Clock3 className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>{lessonTime}</span>
              </div>
            </div>
            {booking.meetingPoint && (
              <p className="mt-3 flex items-start justify-center gap-1.5 text-xs font-medium leading-5 text-slate-500">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>{booking.meetingPoint}</span>
              </p>
            )}
          </section>

          {!['COMPLETED', 'DISPUTED'].includes(booking.status) && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
              A avaliação só fica disponível depois que a aula estiver concluída.
            </div>
          )}

          {error && (
            <div role="alert" className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div aria-busy="true" className="space-y-3 p-4"><div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-12 animate-pulse rounded-2xl bg-slate-100" /></div>
          ) : existingReview ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-emerald-900">Avaliação enviada</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Rating value={existingReview.ratingOverall} showValue={false} size="lg" />
                    <span className="text-xs font-bold text-emerald-800">Nota {existingReview.ratingOverall}/5</span>
                  </div>
                  {existingReview.comment && <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-emerald-800"><MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{existingReview.comment}</p>}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 text-center shadow-sm">
                <p className="text-sm font-black text-[var(--mazzi-dark)]">Como foi sua aula?</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Toque nas estrelas para avaliar</p>
                <div className="mt-4 flex justify-center">
                <Rating value={rating} interactive onChange={setRating} showValue={false} size="lg" ariaLabel="Nota geral" />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-600" aria-live="polite">
                  {rating > 0 ? `Sua nota: ${rating}/5` : 'Selecione uma nota'}
                </p>
              </div>

              <div>
                <label className="mazzi-field-label mb-2 block">
                  Comentário opcional
                </label>
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Conte como foi sua experiência..."
                />
              </div>

            </>
          )}
        </div>
      )}
    </Modal>
  );
};
