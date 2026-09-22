alter table public.companies
 add column if not exists ico_status text not null default 'not_assessed',
 add column if not exists ico_assessed_at timestamptz,
 add column if not exists ico_assessment_reason text,
 add column if not exists ico_assessment_notes text,
 add column if not exists ico_reassessment_trigger text,
 add column if not exists operating_phase text not null default 'pre_trading',
 add column if not exists company_registration_number text,
 add column if not exists trading_name text;

alter table public.companies drop constraint if exists companies_ico_status_check;
alter table public.companies add constraint companies_ico_status_check check (ico_status in ('not_assessed','not_currently_required','exempt','registration_required','registered','reassessment_required'));
alter table public.companies drop constraint if exists companies_operating_phase_check;
alter table public.companies add constraint companies_operating_phase_check check (operating_phase in ('pre_trading','client_operations','candidate_compliance_review','candidate_operations'));
alter table public.companies drop constraint if exists companies_ico_registered_number_check;
alter table public.companies add constraint companies_ico_registered_number_check check (ico_status <> 'registered' or nullif(btrim(ico_registration_number),'') is not null);

update public.companies set
 trading_name='Vorlen',
 company_registration_number='17387520',
 ico_status='not_currently_required',
 ico_assessed_at='2026-09-21T00:00:00+01:00',
 ico_assessment_reason='not_started_trading',
 ico_assessment_notes='Owner completed the official ICO Data Protection Fee self-assessment. Result: no fee required yet because the company has not started trading. Reassess once trading starts.',
 ico_reassessment_trigger='trading_commences',
 operating_phase='pre_trading'
where name='Vorlen';

create or replace function public.candidate_processing_allowed(p_company_id uuid)
returns boolean language sql stable security invoker set search_path=public as $$
 select coalesce((select operating_phase='candidate_operations' and ico_status not in ('not_assessed','not_currently_required','registration_required','reassessment_required') from public.companies where id=p_company_id),false)
$$;
revoke all on function public.candidate_processing_allowed(uuid) from public,anon;
grant execute on function public.candidate_processing_allowed(uuid) to authenticated,service_role;

create or replace function public.enforce_candidate_processing_gate()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if not public.candidate_processing_allowed(new.company_id) then
   raise exception 'Candidate processing is disabled until the candidate compliance review is completed';
 end if;
 return new;
end $$;
revoke all on function public.enforce_candidate_processing_gate() from public,anon,authenticated;

drop trigger if exists candidates_processing_gate on public.candidates;
create trigger candidates_processing_gate before insert or update on public.candidates for each row execute function public.enforce_candidate_processing_gate();
drop trigger if exists applications_processing_gate on public.applications;
create trigger applications_processing_gate before insert or update on public.applications for each row execute function public.enforce_candidate_processing_gate();
drop trigger if exists candidate_submissions_processing_gate on public.candidate_submissions;
create trigger candidate_submissions_processing_gate before insert or update on public.candidate_submissions for each row execute function public.enforce_candidate_processing_gate();

create or replace function public.mark_trading_commenced(p_company_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
 update public.companies set operating_phase='client_operations',
   ico_status=case when ico_status='not_currently_required' then 'reassessment_required' else ico_status end
 where id=p_company_id;
end $$;
revoke all on function public.mark_trading_commenced(uuid) from public,anon,authenticated;
grant execute on function public.mark_trading_commenced(uuid) to service_role;
