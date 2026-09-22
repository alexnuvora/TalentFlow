-- Candidate-facing anonymous RPCs are not needed during the current pre-trading/client-development phase.
revoke execute on function public.book_candidate_slot(text,uuid) from public,anon,authenticated;
revoke execute on function public.public_booking_slots(text) from public,anon,authenticated;
grant execute on function public.book_candidate_slot(text,uuid) to service_role;
grant execute on function public.public_booking_slots(text) to service_role;

-- Ensure newly-created functions do not silently become public API endpoints.
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from authenticated;
