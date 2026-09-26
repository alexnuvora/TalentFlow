create table if not exists public.partner_candidate_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'extended' check (status in ('extended','accepted','declined','withdrawn')),
  offer_type text not null default 'verbal' check (offer_type in ('verbal','written')),
  salary numeric,
  currency text not null default 'GBP',
  proposed_start_date date,
  evidence text not null,
  notes text,
  placement_review_status text not null default 'none' check (placement_review_status in ('none','requested','under_review','completed','declined')),
  placement_id uuid references public.placements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,partner_id,candidate_id,job_id)
);
create index if not exists partner_candidate_offers_partner_idx on public.partner_candidate_offers(company_id,partner_id,updated_at desc);
create index if not exists partner_candidate_offers_review_idx on public.partner_candidate_offers(company_id,placement_review_status,updated_at desc);
create index if not exists partner_candidate_offers_candidate_job_idx on public.partner_candidate_offers(company_id,candidate_id,job_id);
alter table public.partner_candidate_offers enable row level security;
drop policy if exists "partner offer read" on public.partner_candidate_offers;
create policy "partner offer read" on public.partner_candidate_offers for select to authenticated using (
 company_id=(select private.current_company_id()) and ((select private.is_manager()) or (
 partner_id=(select auth.uid()) and (select private.partner_is_active()) and exists(
 select 1 from public.partner_assignments a where a.company_id=partner_candidate_offers.company_id and a.partner_id=(select auth.uid()) and a.candidate_id=partner_candidate_offers.candidate_id and a.completed_at is null))));
drop policy if exists "partner offer manager update" on public.partner_candidate_offers;
create policy "partner offer manager update" on public.partner_candidate_offers for update to authenticated using(company_id=(select private.current_company_id()) and (select private.is_manager())) with check(company_id=(select private.current_company_id()) and (select private.is_manager()));
revoke insert,delete on public.partner_candidate_offers from anon,authenticated;
grant select,update on public.partner_candidate_offers to authenticated;