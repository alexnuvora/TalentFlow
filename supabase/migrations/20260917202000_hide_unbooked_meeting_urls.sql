-- Public availability must not disclose recruiter meeting URLs before a candidate books a slot.
create or replace function public.public_booking_slots(p_token text)
returns table(id uuid, starts_at timestamptz, ends_at timestamptz, meeting_url text)
language sql security definer set search_path='public' as $$
  select s.id,s.starts_at,s.ends_at,null::text as meeting_url
  from public.recruiter_booking_slots s
  join public.candidate_portal_tokens t on t.token=p_token
  where t.revoked_at is null and t.expires_at>now()
    and s.company_id=(select c.company_id from public.candidates c where c.id=t.candidate_id)
    and s.status='available' and s.starts_at>now()
  order by s.starts_at limit 50;
$$;
revoke execute on function public.public_booking_slots(text) from public;
grant execute on function public.public_booking_slots(text) to anon, authenticated;
