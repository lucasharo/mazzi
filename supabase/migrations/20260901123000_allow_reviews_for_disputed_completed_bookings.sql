-- A dispute changes the booking status, but does not undo the completed lesson.
CREATE OR REPLACE FUNCTION public.create_review_for_booking(
  p_booking_id UUID, p_rating INTEGER, p_comment TEXT DEFAULT NULL
)
RETURNS public.reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_student UUID := auth.uid(); v_booking public.bookings%ROWTYPE; v_review public.reviews%ROWTYPE; v_rating_average NUMERIC; v_rating_count INTEGER;
BEGIN
  IF v_student IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM public.lock_student_profile(v_student); PERFORM public.assert_current_user_student();
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'REVIEW_RATING_OUT_OF_RANGE' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_booking.student_id <> v_student THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF v_booking.instructor_id = v_student THEN RAISE EXCEPTION 'PROVIDER_CANNOT_REVIEW_SELF' USING ERRCODE='42501'; END IF;
  IF v_booking.status::TEXT NOT IN ('COMPLETED','DISPUTED') THEN RAISE EXCEPTION 'REVIEW_REQUIRES_COMPLETED_BOOKING' USING ERRCODE='22023'; END IF;
  INSERT INTO public.reviews (booking_id,student_id,provider_id,instructor_id,rating_overall,comment,updated_at)
  VALUES (v_booking.id,v_booking.student_id,v_booking.provider_id,v_booking.instructor_id,p_rating,NULLIF(BTRIM(COALESCE(p_comment,'')),''),NOW()) RETURNING * INTO v_review;
  SELECT COALESCE(ROUND(AVG(rating_overall)::NUMERIC,2),0.00),COUNT(*)::INTEGER INTO v_rating_average,v_rating_count FROM public.reviews WHERE provider_id=v_booking.provider_id;
  UPDATE public.providers SET rating_average=v_rating_average,rating_count=v_rating_count,updated_at=NOW() WHERE id=v_booking.provider_id;
  RETURN v_review;
END; $$;
REVOKE ALL ON FUNCTION public.create_review_for_booking(UUID,INTEGER,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_review_for_booking(UUID,INTEGER,TEXT) TO authenticated;
