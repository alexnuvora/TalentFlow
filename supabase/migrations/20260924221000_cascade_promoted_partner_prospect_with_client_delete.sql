alter table public.partner_prospects
  drop constraint if exists partner_prospects_promoted_client_id_fkey;

alter table public.partner_prospects
  add constraint partner_prospects_promoted_client_id_fkey
  foreign key (promoted_client_id)
  references public.clients(id)
  on delete cascade;
