drop policy if exists "staff_boundary" on public.placements;
drop policy if exists "placements managers all" on public.placements;
create policy "placements managers all"
on public.placements for all to authenticated
using (private.is_manager() and company_id=private.current_company_id())
with check (private.is_manager() and company_id=private.current_company_id());

drop policy if exists "partner agreement accept" on public.partner_agreements;
drop policy if exists "partner agreements managers update" on public.partner_agreements;
create policy "partner agreements managers update"
on public.partner_agreements for update to authenticated
using (company_id=private.current_company_id() and private.is_manager())
with check (company_id=private.current_company_id() and private.is_manager());

create or replace function public.accept_partner_agreement(
  p_agreement uuid,p_accepted_name text,p_user_agent text default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_hash text; v_user uuid := auth.uid(); v_company uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_accepted_name),'') is null then raise exception 'Full legal name is required'; end if;
  select a.company_id,encode(extensions.digest(a.terms_text,'sha256'),'hex')
  into v_company,v_hash
  from public.partner_agreements a
  join public.profiles p on p.id=v_user and p.company_id=a.company_id and p.role='partner'
  where a.id=p_agreement and a.partner_id=v_user and a.status='pending'
  for update;
  if v_hash is null then raise exception 'Pending partner agreement not found'; end if;
  update public.partner_agreements
  set status='accepted',accepted_at=now(),accepted_name=btrim(p_accepted_name),
      terms_hash=v_hash,accepted_terms_hash=v_hash,accepted_user_agent=left(p_user_agent,500)
  where id=p_agreement and partner_id=v_user and status='pending';
  update public.partner_onboarding
  set status='details_pending',agreement_id=p_agreement,updated_at=now()
  where partner_id=v_user and company_id=v_company and status='terms_pending';
  if not found then raise exception 'Partner onboarding record is not ready for agreement acceptance'; end if;
end $$;

revoke all on function public.accept_partner_agreement(uuid,text,text) from public,anon;
grant execute on function public.accept_partner_agreement(uuid,text,text) to authenticated,service_role;
