alter table public.client_terms_documents
  drop constraint if exists client_terms_documents_created_by_fkey;

alter table public.client_terms_documents
  add constraint client_terms_documents_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;
