
-- Keep accepted commercial clients out of prospect state.

update public.clients
set status='active'
where terms_accepted_at is not null
  and status='prospect';

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.clients'::regclass
      and conname='clients_accepted_terms_not_prospect'
  ) then
    alter table public.clients
      add constraint clients_accepted_terms_not_prospect
      check (terms_accepted_at is null or status <> 'prospect');
  end if;
end $$;

create or replace function public.protect_accepted_client_terms()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.terms_accepted_at is not null and new.status='prospect' then
    raise exception 'A client with accepted Terms of Business cannot be returned to prospect status. Use active, paused or closed.';
  end if;

  if old.terms_accepted_at is not null
     and new.terms_accepted_at=old.terms_accepted_at
     and (
       new.business_nature is distinct from old.business_nature
       or new.recruitment_fee_percent is distinct from old.recruitment_fee_percent
       or new.payment_terms_days is distinct from old.payment_terms_days
       or new.rebate_terms is distinct from old.rebate_terms
       or new.terms_version is distinct from old.terms_version
       or new.terms_accepted_by is distinct from old.terms_accepted_by
       or new.terms_acceptance_method is distinct from old.terms_acceptance_method
       or new.terms_evidence is distinct from old.terms_evidence
     ) then
    raise exception 'Accepted commercial terms are immutable. Clear/supersede the acceptance and issue revised Terms of Business.';
  end if;

  return new;
end
$$;
