import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Booking, Review } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { dbService } from '../../lib/db-service';
import { formatDateBR, formatTimeBR } from '../../lib/date-format';
import { Rating } from '../ui/Rating';
import { Textarea } from '../ui/Textarea';

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Avaliar aula concluída" size="md" footer={footer}>
      {!booking ? null : (
        <div className="space-y-5 text-sm">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Sua aula</p>
            <p className="mt-1 font-black text-[var(--mazzi-text)]">{booking.instructorName || booking.providerName}</p>
            {booking.providerName !== booking.instructorName && <p className="text-xs font-semibold text-slate-500">{booking.providerName}</p>}
            <p className="mt-2 text-xs font-semibold text-slate-500">{booking.scheduledStartAt ? formatDateBR(booking.scheduledStartAt) : formatDateBR(booking.scheduledDate)} · {booking.scheduledStartAt ? formatTimeBR(booking.scheduledStartAt) : `${booking.startTime}–${booking.endTime}`}</p>
          </div>

          {!['COMPLETED', 'DISPUTED'].includes(booking.status) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
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
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <p className="font-black text-emerald-900">Avaliação enviada</p>
              <p className="text-xs text-emerald-800 mt-1">
                Nota {existingReview.ratingOverall}/5
                {existingReview.comment ? ` — ${existingReview.comment}` : ''}
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">Nota geral</p>
                <Rating value={rating} interactive onChange={setRating} showValue={false} size="lg" ariaLabel="Nota geral" />
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
