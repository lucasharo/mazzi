-- TASK-089 — Return the server clock with incoming offers.
-- The offer expiry remains enforced by respond_to_instant_offer; this only
-- lets the PRO render the countdown using the same clock as the backend.

CREATE OR REPLACE FUNCTION public.get_my_instant_offers_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_server_now TIMESTAMPTZ := NOW();
  v_offers JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(offer_row) ORDER BY offer_row.created_at DESC), '[]'::JSONB)
  INTO v_offers
  FROM public.get_my_instant_offers() AS offer_row;

  RETURN jsonb_build_object(
    'server_now', v_server_now,
    'offers', v_offers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_instant_offers_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_instant_offers_snapshot() TO authenticated;
