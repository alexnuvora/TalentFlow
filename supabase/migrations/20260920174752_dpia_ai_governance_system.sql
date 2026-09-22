create table if not exists public.ai_governance (
 company_id uuid primary key references public.companies(id) on delete cascade,
 system_name text not null default 'Vorlen AI-assisted candidate screening',
 system_purpose text not null,
 provider_name text,
 model_name text,
 provider_role text not null default 'processor' check(provider_role in ('processor','controller','joint_controller','unassessed')),
 lawful_basis text not null default 'legitimate_interests',
 special_category_condition text,
 solely_automated_significant_decisions boolean not null default false,
 human_review_required boolean not null default true,
 candidate_notice_version text not null default 'privacy-2026-09-20',
 dpia_version text not null default 'DPIA-1.0',
 dpia_status text not null default 'draft' check(dpia_status in ('draft','approved','review_required','suspended')),
 processing_description text not null,
 necessity_proportionality text not null,
 data_categories text not null,
 data_subjects text not null default 'job applicants and work-seekers',
 data_sources text not null,
 recipients text not null,
 retention_controls text not null,
 international_transfers text,
 processor_contract_status text not null default 'unverified' check(processor_contract_status in ('unverified','verified','not_applicable')),
 provider_training_status text not null default 'unverified' check(provider_training_status in ('unverified','no_training','training_permitted')),
 security_controls text not null,
 rights_redress_controls text not null,
 bias_fairness_controls text not null,
 residual_risk text not null default 'medium' check(residual_risk in ('low','medium','high')),
 high_residual_risk boolean not null default true,
 approved_at timestamptz,
 approved_by uuid references auth.users(id),
 next_review_at timestamptz,
 last_reviewed_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.ai_governance_risks (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 category text not null, risk text not null, likelihood text not null check(likelihood in ('low','medium','high')),
 impact text not null check(impact in ('low','medium','high')), controls text not null, residual_risk text not null check(residual_risk in ('low','medium','high')),
 owner text, status text not null default 'open' check(status in ('open','mitigated','accepted','blocked')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_governance_reviews (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 review_type text not null check(review_type in ('dpia','bias','accuracy','provider','incident','annual')),
 version text not null, outcome text not null check(outcome in ('pass','conditional','fail')), summary text not null,
 evidence text, reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now(), next_review_at timestamptz
);
create table if not exists public.ai_governance_changes (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 change_type text not null, description text not null, material boolean not null default true, requires_dpia_review boolean not null default true,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.ai_governance enable row level security;alter table public.ai_governance_risks enable row level security;alter table public.ai_governance_reviews enable row level security;alter table public.ai_governance_changes enable row level security;
grant select,insert,update,delete on public.ai_governance,public.ai_governance_risks,public.ai_governance_reviews,public.ai_governance_changes to authenticated;
create policy "Managers govern AI" on public.ai_governance for all to authenticated using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
create policy "Managers govern AI risks" on public.ai_governance_risks for all to authenticated using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
create policy "Managers govern AI reviews" on public.ai_governance_reviews for all to authenticated using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());
create policy "Managers govern AI changes" on public.ai_governance_changes for all to authenticated using(company_id=public.current_company_id() and public.is_manager()) with check(company_id=public.current_company_id() and public.is_manager());

insert into public.ai_governance(company_id,system_purpose,processing_description,necessity_proportionality,data_categories,data_sources,recipients,retention_controls,security_controls,rights_redress_controls,bias_fairness_controls,international_transfers)
select id,
'Assist human recruiters to assess explicit job-related evidence against the requirements of a specific permanent vacancy. The system is decision support only and must not autonomously reject, hire or introduce a candidate.',
'Candidate application answers, cover note and CV text are compared with the job description and explicit requirements. The provider returns a structured score, summary, strengths, gaps, interview questions and evidence. A human recruiter must review the report before any recruitment decision or client introduction.',
'AI assistance is used to support consistent review and reduce manual workload. It is limited to explicit job-related evidence. Protected traits must not be inferred. A less intrusive manual review remains available and human review is mandatory.',
'Identity/contact data contained in applications or CVs; employment history; education, training and qualifications; professional authorisations; application answers and job-related evidence. Special-category information is not intentionally requested for screening and must not be used for scoring.',
'Candidate directly; candidate CV/application; vacancy and hirer requirements.',
'Authorised Vorlen recruitment staff; configured AI provider acting under the assessed contractual role; hirers only after separate candidate-authorised introduction.',
'Recruitment records follow statutory and documented retention controls. Screening reports remain linked to the recruitment record and are subject to privacy rights and statutory holds.',
'Authenticated staff access, tenant isolation/RLS, server-side provider credentials, bounded CV extraction, untrusted-input prompt isolation, no browser exposure of provider credentials, audit/review records and human-review gates.',
'Candidates receive notice of AI-assisted screening, may request an explanation, challenge an outcome and request human review. AI output alone must not cause rejection or introduction.',
'Only explicit job-related evidence may be assessed. No inference of protected characteristics. Human review is mandatory. Bias and accuracy reviews must be recorded before approval and at least monthly while AI screening is active.',
'Unverified until the configured provider, processing locations, transfer mechanism and contract are documented.'
from public.companies on conflict(company_id) do nothing;

insert into public.ai_governance_risks(company_id,category,risk,likelihood,impact,controls,residual_risk,owner,status)
select id,x.category,x.risk,x.likelihood,x.impact,x.controls,x.residual,x.owner,x.status from public.companies cross join (values
('fairness','AI scoring could disadvantage candidates because of biased or incomplete evidence.','medium','high','Restrict prompts to explicit job-related evidence; prohibit protected-trait inference; require human review; monthly bias review; candidate challenge and human-review route.','medium','CEO / recruitment lead','open'),
('accuracy','CV extraction or model output may omit, misunderstand or hallucinate candidate evidence.','medium','high','Store evidence list; expose gaps; human recruiter reviews source evidence; AI cannot autonomously reject, hire or introduce.','medium','Recruitment lead','open'),
('transparency','Candidates may not understand that AI assists screening or how it affects them.','low','high','Application notice, privacy notice, notice version/time recorded, explanation/challenge/human review route.','low','Privacy lead','mitigated'),
('special_category','CVs may incidentally contain health, ethnicity, religion or other special-category information.','medium','high','Do not request it for screening; instruct model not to infer/use protected traits; human review; minimise data sent where possible; investigate any detected use.','medium','Privacy lead','open'),
('provider','AI provider may retain, train on, or transfer candidate data contrary to Vorlen expectations.','medium','high','Approval blocked until provider role, DPA/contract, training use and international transfers are verified.','high','CEO / privacy lead','blocked'),
('security','Candidate data could be disclosed through credentials, cross-tenant access or insecure storage.','low','high','Server-side credentials, RLS, authenticated staff functions, tenant checks, private resume storage and security reviews.','medium','Technical lead','open')
) as x(category,risk,likelihood,impact,controls,residual,owner,status) on conflict do nothing;

create or replace function public.ai_governance_ready(p_company uuid) returns boolean language sql security definer set search_path='' stable as $$
 select exists(select 1 from public.ai_governance g where g.company_id=p_company and g.dpia_status='approved' and g.human_review_required and not g.solely_automated_significant_decisions and not g.high_residual_risk and g.residual_risk<>'high' and g.provider_role<>'unassessed' and g.processor_contract_status in ('verified','not_applicable') and g.provider_training_status='no_training' and g.approved_at is not null and g.next_review_at>now())
 and exists(select 1 from public.ai_governance_reviews r where r.company_id=p_company and r.review_type='bias' and r.outcome='pass' and r.reviewed_at>now()-interval '35 days')
 and exists(select 1 from public.ai_governance_reviews r where r.company_id=p_company and r.review_type='accuracy' and r.outcome='pass' and r.reviewed_at>now()-interval '35 days')
 and not exists(select 1 from public.ai_governance_risks r where r.company_id=p_company and r.status='blocked' or (r.company_id=p_company and r.residual_risk='high' and r.status<>'mitigated'));
$$;
revoke all on function public.ai_governance_ready(uuid) from public,anon,authenticated;
grant execute on function public.ai_governance_ready(uuid) to service_role;

create or replace function public.approve_ai_governance(p_company uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_company_id()<>p_company or not public.is_manager() then raise exception 'Manager access required';end if;
 if exists(select 1 from public.ai_governance_risks where company_id=p_company and (status='blocked' or (residual_risk='high' and status<>'mitigated'))) then raise exception 'High or blocked AI risks must be resolved before DPIA approval';end if;
 if not exists(select 1 from public.ai_governance_reviews where company_id=p_company and review_type='bias' and outcome='pass' and reviewed_at>now()-interval '35 days') then raise exception 'A current passing bias review is required';end if;
 if not exists(select 1 from public.ai_governance_reviews where company_id=p_company and review_type='accuracy' and outcome='pass' and reviewed_at>now()-interval '35 days') then raise exception 'A current passing accuracy review is required';end if;
 if exists(select 1 from public.ai_governance where company_id=p_company and (provider_role='unassessed' or processor_contract_status='unverified' or provider_training_status<>'no_training' or high_residual_risk)) then raise exception 'Provider assessment, no-training assurance and residual-risk assessment must be complete';end if;
 update public.ai_governance set dpia_status='approved',approved_at=now(),approved_by=auth.uid(),last_reviewed_at=now(),next_review_at=now()+interval '90 days',updated_at=now() where company_id=p_company;
end $$;
revoke all on function public.approve_ai_governance(uuid) from public,anon;
grant execute on function public.approve_ai_governance(uuid) to authenticated;

create or replace function public.invalidate_ai_governance() returns trigger language plpgsql set search_path=public as $$ begin
 if new.material and new.requires_dpia_review then update public.ai_governance set dpia_status='review_required',approved_at=null,approved_by=null,updated_at=now() where company_id=new.company_id;end if;return new;end $$;
drop trigger if exists trg_invalidate_ai_governance on public.ai_governance_changes;
create trigger trg_invalidate_ai_governance after insert on public.ai_governance_changes for each row execute function public.invalidate_ai_governance();
