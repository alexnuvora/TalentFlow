-- Partner client-calling workspace
alter type public.user_role add value if not exists 'partner';

create table if not exists public.partner_client_activity (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'not_contacted' check (status in ('not_contacted','no_answer','contacted','busy','not_interested','call_back','interested','follow_up','meeting_booked','converted','do_not_contact')),
  callback_at timestamptz,
  last_contacted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(company_id,client_id,partner_id),
  constraint partner_callback_required check (status <> 'call_back' or callback_at is not null)
);
create table if not exists public.partner_client_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  note text not null check (length(trim(note)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create table if not exists public.client_ai_briefs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  summary text not null, sector text,
  talking_points jsonb not null default '[]'::jsonb,
  likely_needs jsonb not null default '[]'::jsonb,
  questions_to_ask jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  unique(company_id,client_id)
);
alter table public.partner_client_activity enable row level security;
alter table public.partner_client_notes enable row level security;
alter table public.client_ai_briefs enable row level security;
grant select,insert,update on public.partner_client_activity to authenticated;
grant select,insert on public.partner_client_notes to authenticated;
grant select on public.client_ai_briefs to authenticated;
create policy "partner activity own workspace" on public.partner_client_activity for all to authenticated using (company_id=public.current_company_id() and partner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='partner')) with check (company_id=public.current_company_id() and partner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='partner'));
create policy "partner notes read workspace" on public.partner_client_notes for select to authenticated using (company_id=public.current_company_id() and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('partner','owner','manager')));
create policy "partner notes insert own" on public.partner_client_notes for insert to authenticated with check (company_id=public.current_company_id() and partner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='partner'));
create policy "client briefs workspace read" on public.client_ai_briefs for select to authenticated using (company_id=public.current_company_id() and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('partner','owner','manager')));
drop policy if exists "clients role aware" on public.clients;
create policy "clients role aware" on public.clients for select to authenticated using (company_id=public.current_company_id() and (public.is_manager() or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and (p.role='partner' or (p.role='viewer' and p.client_id=clients.id)))));
create index if not exists partner_activity_callback_idx on public.partner_client_activity(partner_id,callback_at) where callback_at is not null;
create index if not exists partner_notes_client_idx on public.partner_client_notes(client_id,created_at desc);
