alter table public.partner_attributions
  drop constraint if exists partner_attributions_client_id_fkey;

alter table public.partner_attributions
  add constraint partner_attributions_client_id_fkey
  foreign key (client_id)
  references public.clients(id)
  on delete set null;
