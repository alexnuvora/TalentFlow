alter table public.client_contracts drop constraint if exists client_contracts_client_id_fkey;
alter table public.client_contracts drop constraint if exists tenant_client_contracts_client_id_fkey;
alter table public.client_contracts add constraint tenant_client_contracts_client_id_fkey foreign key (company_id, client_id) references public.clients(company_id, id) on delete cascade;
