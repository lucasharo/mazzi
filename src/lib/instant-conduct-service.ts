import { supabase } from './supabase';

export interface InstantConductCase {
  id: string;
  booking_id: string;
  instructor_id: string;
  instructor_name: string;
  kind: 'CANCELLATION' | 'NO_SHOW';
  occurred_at: string;
  reason: string | null;
  decision: 'PENDING' | 'UNJUSTIFIED' | 'EXEMPT';
  review_note: string | null;
  suspension_until: string | null;
  appeal: string | null;
  appealed_at: string | null;
  reviewed_at: string | null;
}

// New RPCs remain isolated until generated database types are refreshed at deployment.
const rpc = supabase.rpc.bind(supabase) as (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
export const instantConductService = {
  async list(): Promise<InstantConductCase[]> {
    const { data, error } = await rpc('get_instant_conduct_cases');
    if (error) throw new Error(error.message);
    return (data || []) as InstantConductCase[];
  },
  async review(id: string, decision: 'UNJUSTIFIED' | 'EXEMPT', note: string): Promise<void> {
    const { error } = await rpc('review_instant_conduct', { p_case_id: id, p_decision: decision, p_note: note });
    if (error) throw new Error(error.message);
  },
  async appeal(id: string, message: string): Promise<void> {
    const { error } = await rpc('appeal_instant_conduct', { p_case_id: id, p_message: message });
    if (error) throw new Error(error.message);
  },
};
