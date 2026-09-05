import React from 'react';
import { CalendarClock } from 'lucide-react';
import type { InstantLessonAvailabilityNotice as InstantLessonAvailabilityNoticeData } from '../../domain/instant-lesson';

interface InstantLessonAvailabilityNoticeProps {
  notice: InstantLessonAvailabilityNoticeData;
}

export const InstantLessonAvailabilityNotice: React.FC<InstantLessonAvailabilityNoticeProps> = ({ notice }) => (
  <section className="mazzi-compact-card rounded-2xl border border-slate-200 bg-slate-50 p-4" role="status" aria-live="polite">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-200 text-slate-700">
        <CalendarClock className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-extrabold text-[var(--mazzi-dark)]">{notice.title}</p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">{notice.description}</p>
      </div>
    </div>
  </section>
);
