-- Preserve the VAT registration position at invoice issue time.
alter table public.invoices
  add column if not exists vat_registered_at_issue boolean not null default false,
  add column if not exists vat_number_at_issue text;

update public.invoices i
set vat_registered_at_issue = (coalesce(i.tax_rate,0) > 0),
    vat_number_at_issue = case when coalesce(i.tax_rate,0) > 0 then co.vat_number else null end
from public.companies co
where i.company_id = co.id;

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
  v_company_vat_number text;
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

  select coalesce(vat_registered,false), coalesce(vat_rate,20), vat_number
  into v_company_vat_registered, v_company_vat_rate, v_company_vat_number
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
    subtotal,tax_rate,tax_amount,total,vat_registered_at_issue,vat_number_at_issue,
    amount_paid,effective_total,balance_due,issue_date,due_date,created_by
  ) values(
    v_company,p.id,p.client_id,v_number,'draft',p.currency,
    p.fee_amount,v_tax_rate,v_tax_amount,v_total,
    v_company_vat_registered,
    case when v_company_vat_registered then v_company_vat_number else null end,
    0,v_total,v_total,p_issue_date,p_issue_date+coalesce(c.payment_terms_days,14),v_uid
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.create_placement_invoice(uuid,date) from public, anon, authenticated;
grant execute on function public.create_placement_invoice(uuid,date) to service_role;
