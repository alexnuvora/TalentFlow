alter table public.partner_commercial_handoffs
  drop constraint if exists partner_commercial_handoffs_client_id_fkey;

alter table public.partner_commercial_handoffs
  add constraint partner_commercial_handoffs_client_id_fkey
  foreign key (client_id)
  references public.clients(id)
  on delete cascade;
