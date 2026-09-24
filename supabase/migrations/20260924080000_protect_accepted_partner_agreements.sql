create or replace function public.protect_partner_agreement_integrity()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if old.status in ('accepted','superseded','terminated') then
    if new.company_id is distinct from old.company_id
       or new.partner_id is distinct from old.partner_id
       or new.version is distinct from old.version
       or new.commission_percent is distinct from old.commission_percent
       or new.terms_text is distinct from old.terms_text
       or new.accepted_at is distinct from old.accepted_at
       or new.accepted_name is distinct from old.accepted_name
       or new.terms_hash is distinct from old.terms_hash
       or new.accepted_terms_hash is distinct from old.accepted_terms_hash
       or new.accepted_user_agent is distinct from old.accepted_user_agent
    then raise exception 'Accepted partner agreement terms are immutable; create a new agreement version instead';end if;
    if old.status='accepted' and new.status not in ('accepted','superseded','terminated') then raise exception 'Accepted partner agreement may only remain accepted, be superseded, or be terminated';end if;
    if old.status in ('superseded','terminated') and new.status<>old.status then raise exception 'Closed partner agreements are immutable';end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_partner_agreement_integrity on public.partner_agreements;
create trigger trg_partner_agreement_integrity before update on public.partner_agreements
for each row execute function public.protect_partner_agreement_integrity();

revoke all on function public.protect_partner_agreement_integrity() from public,anon,authenticated;
grant execute on function public.protect_partner_agreement_integrity() to service_role;
