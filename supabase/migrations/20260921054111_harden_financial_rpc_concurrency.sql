-- Prevent duplicate active invoices for a placement at the database level.
create unique index if not exists invoices_one_active_per_placement
on public.invoices(placement_id) where placement_id is not null and status <> 'void';

-- Allocate invoice numbers transactionally per company/year.
create table if not exists public.invoice_number_sequences(
 company_id uuid not null references public.companies(id) on delete cascade,
 invoice_year integer not null,
 last_number integer not null default 0 check(last_number>=0),
 primary key(company_id,invoice_year)
);
alter table public.invoice_number_sequences enable row level security;
revoke all on public.invoice_number_sequences from public,anon,authenticated;
grant select,insert,update,delete on public.invoice_number_sequences to service_role;

create or replace function public.create_placement_invoice(p_placement uuid,p_issue_date date default current_date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_company uuid; v_role text; p public.placements%rowtype; c public.client_contracts%rowtype; v_id uuid; v_number text; v_seq int; v_year int;
begin
 if v_uid is null then raise exception 'Not authorised'; end if;
 select company_id,role into v_company,v_role from public.profiles where id=v_uid;
 if v_company is null or v_role not in ('owner','manager') then raise exception 'Not authorised'; end if;
 select * into p from public.placements where id=p_placement and company_id=v_company for update;
 if not found then raise exception 'Placement not found'; end if;
 if exists(select 1 from public.invoices where placement_id=p.id and status<>'void') then raise exception 'Active invoice already exists'; end if;
 select * into c from public.client_contracts where id=p.contract_id and company_id=v_company;
 v_year:=extract(year from coalesce(p_issue_date,current_date))::int;
 insert into public.invoice_number_sequences(company_id,invoice_year,last_number) values(v_company,v_year,1)
 on conflict(company_id,invoice_year) do update set last_number=public.invoice_number_sequences.last_number+1
 returning last_number into v_seq;
 v_number:='TF-'||v_year::text||'-'||lpad(v_seq::text,5,'0');
 insert into public.invoices(company_id,placement_id,client_id,number,status,currency,subtotal,tax_rate,tax_amount,total,issue_date,due_date,created_by)
 values(v_company,p.id,p.client_id,v_number,'draft',p.currency,p.fee_amount,p.vat_rate,p.vat_amount,p.total_amount,p_issue_date,p_issue_date+coalesce(c.payment_terms_days,14),v_uid) returning id into v_id;
 update public.placements set invoice_number=v_number,invoice_status='draft',invoiced_at=now(),due_at=(p_issue_date+coalesce(c.payment_terms_days,14))::timestamptz where id=p.id and company_id=v_company;
 return v_id;
end $$;
revoke all on function public.create_placement_invoice(uuid,date) from public,anon;
grant execute on function public.create_placement_invoice(uuid,date) to authenticated,service_role;

-- Campaign reporting can use caller privileges/RLS; no elevation required.
alter function public.campaign_performance() security invoker;

-- Serialize payment changes on the invoice row to prevent concurrent overpayment.
create or replace function public.record_invoice_payment(p_invoice uuid,p_amount numeric,p_method text default 'manual',p_reference text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid; v_id uuid; v_currency char(3); v_due numeric; v_uid uuid:=auth.uid();
begin
 if v_uid is null or p_amount is null or p_amount<=0 then raise exception 'Invalid payment'; end if;
 select company_id,currency,amount_due into v_company,v_currency,v_due from public.invoices where id=p_invoice and status<>'void' for update;
 if v_company is null or not exists(select 1 from public.profiles where id=v_uid and company_id=v_company and role in ('owner','manager')) then raise exception 'Not authorised'; end if;
 if p_amount>coalesce(v_due,0) then raise exception 'Payment exceeds outstanding balance'; end if;
 insert into public.invoice_payments(company_id,invoice_id,amount,currency,method,reference,created_by,status)
 values(v_company,p_invoice,p_amount,v_currency,coalesce(nullif(trim(p_method),''),'manual'),nullif(trim(p_reference),''),v_uid,'succeeded') returning id into v_id;
 perform public.refresh_invoice_balance(p_invoice); return v_id;
end $$;
revoke all on function public.record_invoice_payment(uuid,numeric,text,text) from public,anon;
grant execute on function public.record_invoice_payment(uuid,numeric,text,text) to authenticated,service_role;

-- Serialize adjustment/void operations too.
create or replace function public.record_invoice_adjustment(p_invoice uuid,p_kind text,p_amount numeric,p_reason text,p_reference text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_company uuid; v_role text;
begin
 if v_uid is null then raise exception 'Not authorised'; end if;
 select company_id,role into v_company,v_role from public.profiles where id=v_uid;
 if v_company is null or v_role not in ('owner','manager') then raise exception 'Not authorised'; end if;
 if p_kind not in ('credit','write_off','debit') or p_amount<=0 or length(trim(p_reason))<3 then raise exception 'Invalid adjustment'; end if;
 perform 1 from public.invoices where id=p_invoice and company_id=v_company and status<>'void' for update;
 if not found then raise exception 'Invoice unavailable'; end if;
 insert into public.invoice_adjustments(company_id,invoice_id,kind,amount,reason,reference,created_by) values(v_company,p_invoice,p_kind,p_amount,trim(p_reason),p_reference,v_uid);
 perform public.refresh_invoice_balance(p_invoice);
end $$;

create or replace function public.void_invoice(p_invoice uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare c uuid; v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Not authorised'; end if;
 select company_id into c from public.invoices where id=p_invoice for update;
 if c is null or not exists(select 1 from public.profiles where id=v_uid and company_id=c and role in ('owner','manager')) then raise exception 'Not authorised'; end if;
 if exists(select 1 from public.invoice_payments where invoice_id=p_invoice and status='succeeded') then raise exception 'Paid invoices cannot be voided; record a refund/credit instead'; end if;
 update public.invoices set status='void',voided_at=now(),notes=concat_ws(E'\n',notes,'Void reason: '||coalesce(nullif(trim(p_reason),''),'Not supplied')),updated_at=now() where id=p_invoice and company_id=c;
end $$;
