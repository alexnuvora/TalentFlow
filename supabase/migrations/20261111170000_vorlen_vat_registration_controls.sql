-- Company-level VAT registration controls for recruitment invoicing.
-- Unregistered companies must never add VAT to placement or invoice totals.
alter table public.companies
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_rate numeric(5,2) not null default 20,
  add column if not exists vat_number text,
  add column if not exists vat_effective_from date;

alter table public.companies
  add constraint companies_vat_rate_range check (vat_rate >= 0 and vat_rate <= 100);

-- Client contract VAT is no longer an independently configurable tax decision.
alter table public.client_contracts alter column vat_rate set default 0;
update public.client_contracts cc
set vat_rate = 0, updated_at = now()
from public.companies co
where cc.company_id = co.id and co.vat_registered = false;

alter table public.placements alter column vat_rate set default 0;

-- Keep unissued placements aligned with company VAT registration. Issued invoices
-- and their financial history are deliberately not rewritten.
update public.placements p
set vat_rate = 0,
    vat_amount = 0,
    total_amount = round(coalesce(p.fee_amount,0),2),
    updated_at = now()
from public.companies co
where p.company_id = co.id
  and co.vat_registered = false
  and p.invoice_status = 'not_invoiced'
  and p.invoiced_at is null;

create or replace function public.set_placement_defaults()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.client_contracts%rowtype;
  v_vat_registered boolean := false;
  v_company_vat_rate numeric := 20;
begin
  if new.contract_id is not null then
    select * into c
    from public.client_contracts
    where id = new.contract_id;

    if new.currency is null then new.currency := c.currency; end if;

    if new.fee_amount is null or new.fee_amount = 0 then
      if c.fee_model = 'percentage_salary' then
        new.fee_base := coalesce(new.annual_salary,0);
      elsif c.fee_model = 'percentage_initial_fee' then
        new.fee_base := coalesce(new.initial_fee,c.default_initial_fee,0);
      elsif c.fee_model = 'percentage_first_year_revenue' then
        new.fee_base := coalesce(new.first_year_revenue,0);
      else
        new.fee_base := null;
      end if;
      new.fee_amount := public.calculate_placement_fee(new.contract_id,new.annual_salary,new.initial_fee,new.first_year_revenue);
    end if;

    if new.start_date is not null and new.guarantee_end is null then
      new.guarantee_end := new.start_date + c.replacement_days;
    end if;

    select coalesce(vat_registered,false), coalesce(vat_rate,20)
    into v_vat_registered, v_company_vat_rate
    from public.companies
    where id = new.company_id;

    if v_vat_registered then
      new.vat_rate := v_company_vat_rate;
    else
      new.vat_rate := 0;
    end if;

    new.vat_amount := round(coalesce(new.fee_amount,0) * new.vat_rate / 100, 2);
    new.total_amount := round(coalesce(new.fee_amount,0) + new.vat_amount, 2);

    if new.invoiced_at is not null and new.due_at is null then
      new.due_at := new.invoiced_at::date + c.payment_terms_days;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.create_placement_invoice(
  p_placement uuid,
  p_issue_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_role text;
  p public.placements%rowtype;
  c public.client_contracts%rowtype;
  v_company_vat_registered boolean := false;
  v_company_vat_rate numeric := 20;
  v_tax_rate numeric := 0;
  v_tax_amount numeric := 0;
  v_total numeric := 0;
  v_id uuid;
  v_number text;
  v_seq int;
  v_year int;
begin
  if v_uid is null then raise exception 'Not authorised'; end if;

  select company_id, role into v_company, v_role
  from public.profiles where id = v_uid;

  if v_company is null or v_role not in ('owner','manager') then
    raise exception 'Not authorised';
  end if;

  select * into p
  from public.placements
  where id = p_placement and company_id = v_company
  for update;

  if not found then raise exception 'Placement not found'; end if;

  if exists (
    select 1 from public.invoices
    where placement_id = p.id and status <> 'void'
  ) then
    raise exception 'Active invoice already exists';
  end if;

  select * into c
  from public.client_contracts
  where id = p.contract_id and company_id = v_company;

  select coalesce(vat_registered,false), coalesce(vat_rate,20)
  into v_company_vat_registered, v_company_vat_rate
  from public.companies
  where id = v_company;

  if v_company_vat_registered then
    v_tax_rate := v_company_vat_rate;
  else
    v_tax_rate := 0;
  end if;

  v_tax_amount := round(coalesce(p.fee_amount,0) * v_tax_rate / 100, 2);
  v_total := round(coalesce(p.fee_amount,0) + v_tax_amount, 2);

  v_year := extract(year from coalesce(p_issue_date,current_date))::int;

  insert into public.invoice_number_sequences(company_id,invoice_year,last_number)
  values(v_company,v_year,1)
  on conflict(company_id,invoice_year)
  do update set last_number = public.invoice_number_sequences.last_number + 1
  returning last_number into v_seq;

  v_number := 'TF-' || v_year::text || '-' || lpad(v_seq::text,5,'0');

  update public.placements
  set vat_rate = v_tax_rate,
      vat_amount = v_tax_amount,
      total_amount = v_total,
      invoice_number = v_number,
      invoice_status = 'draft',
      invoiced_at = now(),
      due_at = (p_issue_date + coalesce(c.payment_terms_days,14))::timestamptz
  where id = p.id and company_id = v_company;

  insert into public.invoices(
    company_id,placement_id,client_id,number,status,currency,
    subtotal,tax_rate,tax_amount,total,amount_paid,effective_total,balance_due,
    issue_date,due_date,created_by
  ) values(
    v_company,p.id,p.client_id,v_number,'draft',p.currency,
    p.fee_amount,v_tax_rate,v_tax_amount,v_total,0,v_total,v_total,
    p_issue_date,p_issue_date+coalesce(c.payment_terms_days,14),v_uid
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.create_placement_invoice(uuid,date) from public, anon, authenticated;
grant execute on function public.create_placement_invoice(uuid,date) to service_role;
