import React, { useEffect, useState } from 'react';
import { AlertCircle, Star } from 'lucide-react';
import { Booking, Review } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { dbService } from '../../lib/db-service';

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
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !booking) return;

    setRating(5);
    setComment('');
    setExistingReview(null);
    setError(null);

    const loadExistingReview = async () => {
      setLoading(true);
      try {
        const review = await dbService.getReviewForBooking(booking.id);
        setExistingReview(review);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível verificar avaliação existente.');
      } finally {
        setLoading(false);
      }
    };

    void loadExistingReview();
  }, [isOpen, booking?.id]);

  const handleSubmit = async () => {
    if (!booking || submitting || existingReview) return;

    setSubmitting(true);
    setError(null);
    try {
      const review = await dbService.createReviewForBooking(booking.id, rating, comment);
      setExistingReview(review);
      onSubmitted?.(review);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar sua avaliação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Avaliar aula concluída" size="md">
      {!booking ? null : (
        <div className="space-y-4 text-sm">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="font-black text-slate-900">{booking.providerName}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {booking.scheduledDate} • {booking.startTime}–{booking.endTime}
            </p>
          </div>

          {booking.status !== 'COMPLETED' && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
              A avaliação só fica disponível depois que a aula estiver concluída.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-6 text-center text-xs font-bold text-slate-500">Carregando avaliação...</div>
          ) : existingReview ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <p className="font-black text-emerald-900">Avaliação já enviada</p>
              <p className="text-xs text-emerald-800 mt-1">
                Nota {existingReview.ratingOverall}/5
                {existingReview.comment ? ` — ${existingReview.comment}` : ''}
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">Nota geral</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`p-2 rounded-xl transition ${
                        value <= rating ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-300'
                      }`}
                    >
                      <Star className="w-5 h-5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">
                  Comentário opcional
                </label>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Conte como foi sua experiência..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Fechar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  isLoading={submitting}
                  disabled={booking.status !== 'COMPLETED'}
                >
                  Enviar avaliação
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
