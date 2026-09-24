create or replace function private.enforce_job_relationship_scope()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id) then raise exception 'Job client must belong to the same workspace';end if;
  return new;
end $$;
drop trigger if exists trg_job_relationship_scope on public.jobs;
create trigger trg_job_relationship_scope before insert or update of company_id,client_id on public.jobs for each row execute function private.enforce_job_relationship_scope();

create or replace function private.enforce_application_relationship_scope()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id) then raise exception 'Application job must belong to the same workspace';end if;
  if not exists(select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id) then raise exception 'Application candidate must belong to the same workspace';end if;
  return new;
end $$;
drop trigger if exists trg_application_relationship_scope on public.applications;
create trigger trg_application_relationship_scope before insert or update of company_id,job_id,candidate_id on public.applications for each row execute function private.enforce_application_relationship_scope();

create or replace function private.enforce_interview_relationship_scope()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id) then raise exception 'Interview client must belong to the same workspace';end if;
  if not exists(select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id and j.client_id=new.client_id) then raise exception 'Interview vacancy must belong to the same client and workspace';end if;
  if not exists(select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id) then raise exception 'Interview candidate must belong to the same workspace';end if;
  return new;
end $$;
drop trigger if exists trg_interview_relationship_scope on public.interviews;
create trigger trg_interview_relationship_scope before insert or update of company_id,client_id,job_id,candidate_id on public.interviews for each row execute function private.enforce_interview_relationship_scope();

create or replace function private.enforce_candidate_submission_relationship_scope()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id) then raise exception 'Submission client must belong to the same workspace';end if;
  if not exists(select 1 from public.jobs j where j.id=new.job_id and j.company_id=new.company_id and j.client_id=new.client_id) then raise exception 'Submission vacancy must belong to the same client and workspace';end if;
  if not exists(select 1 from public.candidates c where c.id=new.candidate_id and c.company_id=new.company_id) then raise exception 'Submission candidate must belong to the same workspace';end if;
  if new.application_id is not null and not exists(select 1 from public.applications a where a.id=new.application_id and a.company_id=new.company_id and a.job_id=new.job_id and a.candidate_id=new.candidate_id) then raise exception 'Submission application must match the same vacancy, candidate and workspace';end if;
  return new;
end $$;
drop trigger if exists trg_candidate_submission_relationship_scope on public.candidate_submissions;
create trigger trg_candidate_submission_relationship_scope before insert or update of company_id,client_id,job_id,candidate_id,application_id on public.candidate_submissions for each row execute function private.enforce_candidate_submission_relationship_scope();

create or replace function private.enforce_invoice_relationship_scope()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.clients c where c.id=new.client_id and c.company_id=new.company_id) then raise exception 'Invoice client must belong to the same workspace';end if;
  if new.placement_id is not null and not exists(select 1 from public.placements p where p.id=new.placement_id and p.company_id=new.company_id and p.client_id=new.client_id) then raise exception 'Invoice placement must belong to the same client and workspace';end if;
  return new;
end $$;
drop trigger if exists trg_invoice_relationship_scope on public.invoices;
create trigger trg_invoice_relationship_scope before insert or update of company_id,client_id,placement_id on public.invoices for each row execute function private.enforce_invoice_relationship_scope();

create or replace function private.enforce_invoice_payment_relationship_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_currency text;
begin
  select trim(i.currency::text) into v_currency from public.invoices i where i.id=new.invoice_id and i.company_id=new.company_id;
  if v_currency is null then raise exception 'Payment invoice must belong to the same workspace';end if;
  if upper(trim(new.currency::text))<>upper(v_currency) then raise exception 'Payment currency must match the invoice currency';end if;
  if new.amount<=0 then raise exception 'Payment amount must be greater than zero';end if;
  return new;
end $$;
drop trigger if exists trg_invoice_payment_relationship_scope on public.invoice_payments;
create trigger trg_invoice_payment_relationship_scope before insert or update of company_id,invoice_id,amount,currency on public.invoice_payments for each row execute function private.enforce_invoice_payment_relationship_scope();

create or replace function private.enforce_invoice_adjustment_relationship_scope()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.invoices i where i.id=new.invoice_id and i.company_id=new.company_id) then raise exception 'Invoice adjustment must reference an invoice in the same workspace';end if;
  if new.amount<=0 then raise exception 'Adjustment amount must be greater than zero';end if;
  return new;
end $$;
drop trigger if exists trg_invoice_adjustment_relationship_scope on public.invoice_adjustments;
create trigger trg_invoice_adjustment_relationship_scope before insert or update of company_id,invoice_id,amount on public.invoice_adjustments for each row execute function private.enforce_invoice_adjustment_relationship_scope();

revoke all on function private.enforce_job_relationship_scope() from public,anon,authenticated;
revoke all on function private.enforce_application_relationship_scope() from public,anon,authenticated;
revoke all on function private.enforce_interview_relationship_scope() from public,anon,authenticated;
revoke all on function private.enforce_candidate_submission_relationship_scope() from public,anon,authenticated;
revoke all on function private.enforce_invoice_relationship_scope() from public,anon,authenticated;
revoke all on function private.enforce_invoice_payment_relationship_scope() from public,anon,authenticated;
revoke all on function private.enforce_invoice_adjustment_relationship_scope() from public,anon,authenticated;

grant execute on function private.enforce_job_relationship_scope() to service_role;
grant execute on function private.enforce_application_relationship_scope() to service_role;
grant execute on function private.enforce_interview_relationship_scope() to service_role;
grant execute on function private.enforce_candidate_submission_relationship_scope() to service_role;
grant execute on function private.enforce_invoice_relationship_scope() to service_role;
grant execute on function private.enforce_invoice_payment_relationship_scope() to service_role;
grant execute on function private.enforce_invoice_adjustment_relationship_scope() to service_role;
