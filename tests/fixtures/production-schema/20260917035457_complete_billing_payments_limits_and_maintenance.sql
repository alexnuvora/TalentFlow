create table if not exists public.invoice_payments (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, invoice_id uuid not null references public.invoices(id) on delete cascade,
 amount numeric(12,2) not null check(amount>0), currency char(3) not null default 'GBP', method text not null default 'manual', reference text, provider text, provider_payment_id text,
 status text not null default 'succeeded' check(status in ('pending','succeeded','failed','refunded')), paid_at timestamptz not null default now(), created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(company_id,provider,provider_payment_id)
);
alter table public.invoice_payments enable row level security;
grant select,insert on public.invoice_payments to authenticated;
drop policy if exists invoice_payments_select on public.invoice_payments;
create policy invoice_payments_select on public.invoice_payments for select to authenticated using(company_id=(select company_id from public.profiles where id=(select auth.uid())));
drop policy if exists invoice_payments_insert on public.invoice_payments;
create policy invoice_payments_insert on public.invoice_payments for insert to authenticated with check(company_id=(select company_id from public.profiles where id=(select auth.uid())) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('owner','manager')));

create or replace function public.refresh_invoice_balance(p_invoice uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_total numeric; v_paid numeric; v_status text; begin
 select greatest(0,total-coalesce((select sum(case when kind in ('credit','write_off') then amount when kind in ('debit','charge') then -amount else 0 end) from public.invoice_adjustments where invoice_id=p_invoice),0)) into v_total from public.invoices where id=p_invoice;
 select coalesce(sum(case when status='succeeded' then amount when status='refunded' then -amount else 0 end),0) into v_paid from public.invoice_payments where invoice_id=p_invoice;
 select status into v_status from public.invoices where id=p_invoice;
 update public.invoices set amount_paid=least(v_total,greatest(0,v_paid)),amount_due=greatest(0,v_total-v_paid),status=case when v_status='void' then 'void' when v_total-v_paid<=0 then 'paid' when v_paid>0 then 'partially_paid' when due_date<current_date and status in ('sent','overdue','partially_paid') then 'overdue' else status end,paid_at=case when v_total-v_paid<=0 then coalesce(paid_at,now()) else null end,updated_at=now() where id=p_invoice;
end $$;
revoke all on function public.refresh_invoice_balance(uuid) from public,anon,authenticated;

create or replace function public.record_invoice_payment(p_invoice uuid,p_amount numeric,p_method text default 'manual',p_reference text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_company uuid; v_id uuid; begin
 select company_id into v_company from public.invoices where id=p_invoice;
 if v_company is null or not exists(select 1 from public.profiles where id=auth.uid() and company_id=v_company and role in ('owner','manager')) then raise exception 'Not authorised'; end if;
 insert into public.invoice_payments(company_id,invoice_id,amount,method,reference,created_by) values(v_company,p_invoice,p_amount,coalesce(nullif(p_method,''),'manual'),p_reference,auth.uid()) returning id into v_id;
 perform public.refresh_invoice_balance(p_invoice); return v_id;
end $$;
revoke all on function public.record_invoice_payment(uuid,numeric,text,text) from public,anon;
grant execute on function public.record_invoice_payment(uuid,numeric,text,text) to authenticated;

create or replace function public.invoice_payment_refresh_trigger() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.refresh_invoice_balance(coalesce(new.invoice_id,old.invoice_id)); return coalesce(new,old); end $$;
revoke all on function public.invoice_payment_refresh_trigger() from public,anon,authenticated;
drop trigger if exists invoice_payment_refresh on public.invoice_payments;
create trigger invoice_payment_refresh after insert or update or delete on public.invoice_payments for each row execute function public.invoice_payment_refresh_trigger();

create or replace function public.mark_overdue_invoices() returns integer language plpgsql security definer set search_path=public as $$ declare n integer; begin update public.invoices set status='overdue',updated_at=now() where due_date<current_date and amount_due>0 and status in ('sent','partially_paid'); get diagnostics n=row_count; return n; end $$;
revoke all on function public.mark_overdue_invoices() from public,anon,authenticated;

create or replace function public.current_plan_limits(p_company uuid) returns table(recruiter_limit int,active_job_limit int,candidate_limit int,automation_limit int,status text,trial_ends_at timestamptz) language sql stable security definer set search_path=public as $$ select p.recruiter_limit,p.active_job_limit,p.candidate_limit,p.automation_limit,s.status,s.trial_ends_at from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code where s.company_id=p_company $$;
revoke all on function public.current_plan_limits(uuid) from public,anon; grant execute on function public.current_plan_limits(uuid) to authenticated;

create or replace function public.enforce_saas_limit() returns trigger language plpgsql security definer set search_path=public as $$
declare lim int; cnt int; sub_status text; trial_end timestamptz; begin
 select status,trial_ends_at into sub_status,trial_end from public.company_subscriptions where company_id=new.company_id;
 if sub_status is not null and sub_status not in ('active','trialing') then raise exception 'Workspace subscription is not active'; end if;
 if sub_status='trialing' and trial_end<now() then raise exception 'Workspace trial has expired'; end if;
 if tg_table_name='jobs' then select p.active_job_limit into lim from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code where s.company_id=new.company_id; if lim is not null and lim>=0 and coalesce(new.status::text,'')='published' then select count(*) into cnt from public.jobs where company_id=new.company_id and status::text='published' and id<>new.id; if cnt>=lim then raise exception 'Active job plan limit reached'; end if; end if;
 elsif tg_table_name='candidates' then select p.candidate_limit into lim from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code where s.company_id=new.company_id; if lim is not null and lim>=0 then select count(*) into cnt from public.candidates where company_id=new.company_id and id<>new.id; if cnt>=lim then raise exception 'Candidate plan limit reached'; end if; end if;
 elsif tg_table_name='automation_sequences' then select p.automation_limit into lim from public.company_subscriptions s join public.saas_plans p on p.code=s.plan_code where s.company_id=new.company_id; if lim is not null and lim>=0 then select count(*) into cnt from public.automation_sequences where company_id=new.company_id and id<>new.id; if cnt>=lim then raise exception 'Automation plan limit reached'; end if; end if; end if; return new; end $$;
revoke all on function public.enforce_saas_limit() from public,anon,authenticated;
drop trigger if exists enforce_jobs_saas_limit on public.jobs; create trigger enforce_jobs_saas_limit before insert or update of status on public.jobs for each row execute function public.enforce_saas_limit();
drop trigger if exists enforce_candidates_saas_limit on public.candidates; create trigger enforce_candidates_saas_limit before insert on public.candidates for each row execute function public.enforce_saas_limit();
drop trigger if exists enforce_automation_saas_limit on public.automation_sequences; create trigger enforce_automation_saas_limit before insert on public.automation_sequences for each row execute function public.enforce_saas_limit();

