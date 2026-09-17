-- Stripe webhook delivery is at-least-once. Keep a private processing ledger so retries cannot apply subscription state twice.
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing','processed','failed')),
  attempts integer not null default 1 check (attempts > 0),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from anon, authenticated;
grant select, insert, update on table public.stripe_webhook_events to service_role;
create index if not exists stripe_webhook_events_status_idx on public.stripe_webhook_events(status, updated_at);
