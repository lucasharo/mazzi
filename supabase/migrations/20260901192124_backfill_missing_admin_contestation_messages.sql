-- Include legacy/current requests that were saved before the history trigger
-- (or during a failed trigger deployment) but have no history row yet.
CREATE OR REPLACE FUNCTION public.get_booking_dispute_messages(p_dispute_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path TO public, pg_temp AS $$
  WITH history AS (
    SELECT m.id, m.dispute_id, m.author_id, m.author_role, m.message_type, m.content, m.created_at
    FROM public.booking_dispute_messages m
    WHERE m.dispute_id=p_dispute_id
  ), missing_request AS (
    SELECT d.id AS dispute_id, d.information_request AS content, d.updated_at AS created_at
    FROM public.booking_disputes d
    WHERE d.id=p_dispute_id AND NULLIF(btrim(d.information_request),'') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.booking_dispute_messages m
        WHERE m.dispute_id=d.id AND m.message_type='INFORMATION_REQUEST' AND m.content=d.information_request
      )
  ), all_messages AS (
    SELECT * FROM history
    UNION ALL
    SELECT gen_random_uuid(), dispute_id, NULL::UUID, 'ADMIN'::VARCHAR, 'INFORMATION_REQUEST'::VARCHAR, content, created_at
    FROM missing_request
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(all_messages) ORDER BY created_at, id),'[]'::JSONB) FROM all_messages;
$$;
REVOKE ALL ON FUNCTION public.get_booking_dispute_messages(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_dispute_messages(UUID) TO authenticated;
