alter table public.clients
 add column if not exists business_nature text,
 add column if not exists terms_version text,
 add column if not exists terms_accepted_at timestamptz,
 add column if not exists terms_accepted_by text,
 add column if not exists terms_acceptance_method text,
 add column if not exists terms_evidence text;

alter table public.jobs
 add column if not exists start_date date,
 add column if not exists duration_text text,
 add column if not exists duties text,
 add column if not exists work_days_hours text,
 add column if not exists health_safety_risks text,
 add column if not exists health_safety_measures text,
 add column if not exists required_qualifications text,
 add column if not exists expenses_text text,
 add column if not exists minimum_remuneration_text text,
 add column if not exists pay_interval text,
 add column if not exists notice_period text,
 add column if not exists genuine_vacancy_confirmed_at timestamptz,
 add column if not exists client_instruction_reference text;

alter table public.candidates
 add column if not exists work_seeker_terms_version text,
 add column if not exists work_seeker_terms_agreed_at timestamptz,
 add column if not exists work_seeker_terms_evidence text;

alter table public.applications
 add column if not exists work_seeker_terms_version text,
 add column if not exists work_seeker_terms_agreed_at timestamptz;

create or replace function public.assert_job_publish_compliance()
returns trigger language plpgsql set search_path=public as $$
declare cl public.clients%rowtype; co public.companies%rowtype;
begin
 if new.status::text <> 'published' then return new; end if;
 select * into cl from public.clients where id=new.client_id and company_id=new.company_id;
 select * into co from public.companies where id=new.company_id;
 if co.legal_name is null or btrim(co.legal_name)='' or co.legal_address is null or btrim(co.legal_address)='' or co.privacy_email is null or btrim(co.privacy_email)='' then
   raise exception 'Agency legal identity and privacy contact must be configured before publishing vacancies';
 end if;
 if cl.id is null or cl.terms_accepted_at is null or cl.terms_version is null or cl.business_nature is null or btrim(cl.business_nature)='' then
   raise exception 'Client terms and nature of business must be recorded before publishing vacancies';
 end if;
 if new.application_mode <> 'register_interest' then
   if new.genuine_vacancy_confirmed_at is null or coalesce(btrim(new.client_instruction_reference),'')='' then raise exception 'A genuine client instruction must be evidenced before publication'; end if;
   if new.start_date is null or coalesce(btrim(new.duration_text),'')='' or coalesce(btrim(new.duties),'')='' or coalesce(btrim(new.work_days_hours),'')='' then raise exception 'Start date, duration, duties and days/hours are required'; end if;
   if coalesce(btrim(new.health_safety_risks),'')='' or coalesce(btrim(new.required_qualifications),'')='' or coalesce(btrim(new.expenses_text),'')='' then raise exception 'Health and safety, qualifications and expenses information are required'; end if;
   if coalesce(btrim(new.minimum_remuneration_text),'')='' or coalesce(btrim(new.pay_interval),'')='' or coalesce(btrim(new.notice_period),'')='' then raise exception 'Remuneration, pay interval and notice period are required for agency vacancies'; end if;
 end if;
 return new;
end $$;
drop trigger if exists trg_assert_job_publish_compliance on public.jobs;
create trigger trg_assert_job_publish_compliance before insert or update of status on public.jobs for each row execute function public.assert_job_publish_compliance();

update public.jobs set status='draft' where status::text='published' and (
 genuine_vacancy_confirmed_at is null or client_instruction_reference is null
 or not exists(select 1 from public.clients c where c.id=jobs.client_id and c.terms_accepted_at is not null)
 or not exists(select 1 from public.companies co where co.id=jobs.company_id and co.legal_name is not null and co.legal_address is not null and co.privacy_email is not null)
);

create index if not exists idx_candidates_retention_review on public.candidates(company_id,retention_review_at) where erased_at is null;
