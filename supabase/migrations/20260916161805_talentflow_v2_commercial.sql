-- TalentFlow commercial / placement engine
-- Run after supabase/schema.sql in Supabase SQL Editor.

create type public.contract_status as enum ('draft','active','paused','expired','terminated');
create type public.fee_model as enum ('percentage_salary','flat_fee','percentage_initial_fee','percentage_first_year_revenue','custom');
create type public.invoice_status as enum ('not_invoiced','draft','sent','paid','overdue','void');

create table if not exists public.client_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  status public.contract_status not null default 'draft',
  fee_model public.fee_model not null default 'percentage_salary',
  fee_percentage numeric(7,4),
  flat_fee numeric(12,2),
  default_initial_fee numeric(12,2),
  replacement_days integer not null default 90 check (replacement_days >= 0 and replacement_days <= 730),
  candidate_ownership_days integer not null default 180 check (candidate_ownership_days >= 0 and candidate_ownership_days <= 730),
  vat_rate numeric(5,2) not null default 20 check (vat_rate >= 0 and vat_rate <= 100),
  payment_terms_days integer not null default 14 check (payment_terms_days >= 0 and payment_terms_days <= 180),
  currency char(3) not null default 'GBP',
  signed_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((fee_model in ('percentage_salary','percentage_initial_fee','percentage_first_year_revenue') and fee_percentage is not null and fee_percentage >= 0 and fee_percentage <= 100)
      or (fee_model = 'flat_fee' and flat_fee is not null and flat_fee >= 0)
      or fee_model = 'custom')
);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete restrict,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  contract_id uuid references public.client_contracts(id) on delete set null,
  start_date date,
  annual_salary numeric(12,2),
  initial_fee numeric(12,2),
  first_year_revenue numeric(12,2),
  fee_base numeric(12,2),
  fee_amount numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 20 check (vat_rate >= 0 and vat_rate <= 100),
  vat_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency char(3) not null default 'GBP',
  invoice_status public.invoice_status not null default 'not_invoiced',
  invoice_number text,
  invoiced_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  guarantee_end date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contracts_client on public.client_contracts(client_id);
create index if not exists idx_contracts_status on public.client_contracts(status);
create index if not exists idx_placements_client on public.placements(client_id);
create index if not exists idx_placements_candidate on public.placements(candidate_id);
create index if not exists idx_placements_invoice_status on public.placements(invoice_status);
create index if not exists idx_placements_due_at on public.placements(due_at);

alter table public.client_contracts enable row level security;
alter table public.placements enable row level security;

create policy "contracts tenant" on public.client_contracts for all using (company_id=public.current_company_id()) with check (company_id=public.current_company_id());
create policy "placements tenant" on public.placements for all using (company_id=public.current_company_id()) with check (company_id=public.current_company_id());

create or replace function public.calculate_placement_fee(
  p_contract_id uuid,
  p_annual_salary numeric,
  p_initial_fee numeric,
  p_first_year_revenue numeric
) returns numeric
language plpgsql stable security definer set search_path=public
as $$
declare c public.client_contracts%rowtype; base numeric := 0;
begin
  select * into c from public.client_contracts where id=p_contract_id;
  if not found then return 0; end if;
  if c.fee_model='percentage_salary' then base := coalesce(p_annual_salary,0); return round(base * coalesce(c.fee_percentage,0) / 100, 2);
  elsif c.fee_model='flat_fee' then return round(coalesce(c.flat_fee,0),2);
  elsif c.fee_model='percentage_initial_fee' then base := coalesce(p_initial_fee,c.default_initial_fee,0); return round(base * coalesce(c.fee_percentage,0) / 100, 2);
  elsif c.fee_model='percentage_first_year_revenue' then base := coalesce(p_first_year_revenue,0); return round(base * coalesce(c.fee_percentage,0) / 100, 2);
  end if;
  return 0;
end;
$$;

create or replace function public.set_placement_defaults() returns trigger
language plpgsql security definer set search_path=public
as $$
declare c public.client_contracts%rowtype;
begin
  if new.contract_id is not null then
    select * into c from public.client_contracts where id=new.contract_id;
    if new.currency is null then new.currency := c.currency; end if;
    if new.fee_amount is null or new.fee_amount=0 then
      if c.fee_model='percentage_salary' then new.fee_base := coalesce(new.annual_salary,0);
      elsif c.fee_model='percentage_initial_fee' then new.fee_base := coalesce(new.initial_fee,c.default_initial_fee,0);
      elsif c.fee_model='percentage_first_year_revenue' then new.fee_base := coalesce(new.first_year_revenue,0);
      else new.fee_base := null;
      end if;
      new.fee_amount := public.calculate_placement_fee(new.contract_id,new.annual_salary,new.initial_fee,new.first_year_revenue);
    end if;
    if new.start_date is not null and new.guarantee_end is null then new.guarantee_end := new.start_date + c.replacement_days; end if;
    if new.vat_rate is null or new.vat_rate=20 then new.vat_rate := c.vat_rate; end if;
    new.vat_amount := round(coalesce(new.fee_amount,0) * coalesce(new.vat_rate,0) / 100, 2);
    new.total_amount := round(coalesce(new.fee_amount,0) + coalesce(new.vat_amount,0), 2);
    if new.invoiced_at is not null and new.due_at is null then new.due_at := new.invoiced_at::date + c.payment_terms_days; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_placement_defaults on public.placements;
create trigger trg_placement_defaults before insert or update on public.placements for each row execute function public.set_placement_defaults();
