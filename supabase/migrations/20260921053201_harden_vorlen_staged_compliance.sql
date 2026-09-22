alter table public.companies add column if not exists compliance_updated_at timestamptz not null default now();
alter table public.companies add column if not exists ico_reassessment_required_at timestamptz;

create or replace function public.candidate_processing_allowed(p_company_id uuid)
returns boolean language sql stable security invoker set search_path=public as $$
 select coalesce((select operating_phase='candidate_operations'
   and ico_status in ('exempt','registered')
   and (ico_status <> 'registered' or nullif(btrim(ico_registration_number),'') is not null)
 from public.companies where id=p_company_id),false)
$$;
revoke all on function public.candidate_processing_allowed(uuid) from public,anon;
grant execute on function public.candidate_processing_allowed(uuid) to authenticated,service_role;

create or replace function public.enforce_candidate_processing_gate()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if not public.candidate_processing_allowed(new.company_id) then
   raise exception 'Candidate processing is disabled until candidate compliance review is completed and the ICO fee position has been reassessed.';
 end if;
 return new;
end $$;
revoke all on function public.enforce_candidate_processing_gate() from public,anon,authenticated;

create or replace function public.mark_trading_commenced(p_company_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
 update public.companies
 set operating_phase='client_operations',
     ico_status=case when ico_status='not_currently_required' then 'reassessment_required' else ico_status end,
     ico_reassessment_required_at=case when ico_status='not_currently_required' then now() else ico_reassessment_required_at end,
     compliance_updated_at=now()
 where id=p_company_id;
end $$;
revoke all on function public.mark_trading_commenced(uuid) from public,anon,authenticated;
grant execute on function public.mark_trading_commenced(uuid) to service_role;

create or replace function public.enforce_company_compliance_state()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.ico_status='registered' and nullif(btrim(new.ico_registration_number),'') is null then
   raise exception 'ICO registration number is required when ICO status is registered';
 end if;
 if new.ico_status <> 'registered' and new.ico_registration_number is not null then
   raise exception 'ICO registration number must remain NULL unless ICO status is registered';
 end if;
 if old.ico_status='not_currently_required'
    and old.operating_phase='pre_trading'
    and new.operating_phase <> 'pre_trading'
    and new.ico_status='not_currently_required' then
   new.ico_status := 'reassessment_required';
   new.ico_reassessment_required_at := coalesce(new.ico_reassessment_required_at,now());
 end if;
 if new.operating_phase='candidate_operations' and new.ico_status not in ('exempt','registered') then
   raise exception 'Candidate operations require a completed current ICO fee assessment (exempt or registered)';
 end if;
 new.compliance_updated_at := now();
 return new;
end $$;
revoke all on function public.enforce_company_compliance_state() from public,anon,authenticated;

drop trigger if exists companies_compliance_state_guard on public.companies;
create trigger companies_compliance_state_guard before update on public.companies for each row execute function public.enforce_company_compliance_state();

create table if not exists public.compliance_audit_log(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 event_type text not null,
 old_state jsonb,
 new_state jsonb,
 created_at timestamptz not null default now()
);
alter table public.compliance_audit_log enable row level security;
revoke all on table public.compliance_audit_log from anon,authenticated;
grant select,insert on table public.compliance_audit_log to service_role;
create index if not exists compliance_audit_log_company_created_idx on public.compliance_audit_log(company_id,created_at desc);

create or replace function public.audit_company_compliance_state()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if row(old.ico_status,old.operating_phase,old.ico_registration_number,old.ico_assessed_at)
    is distinct from row(new.ico_status,new.operating_phase,new.ico_registration_number,new.ico_assessed_at) then
   insert into public.compliance_audit_log(company_id,event_type,old_state,new_state)
   values(new.id,'company_compliance_state_changed',
     jsonb_build_object('ico_status',old.ico_status,'operating_phase',old.operating_phase,'ico_registration_number',old.ico_registration_number,'ico_assessed_at',old.ico_assessed_at),
     jsonb_build_object('ico_status',new.ico_status,'operating_phase',new.operating_phase,'ico_registration_number',new.ico_registration_number,'ico_assessed_at',new.ico_assessed_at));
 end if;
 return new;
end $$;
revoke all on function public.audit_company_compliance_state() from public,anon,authenticated;
drop trigger if exists companies_compliance_audit on public.companies;
create trigger companies_compliance_audit after update on public.companies for each row execute function public.audit_company_compliance_state();

update public.companies set compliance_updated_at=now() where company_registration_number='17387520';
