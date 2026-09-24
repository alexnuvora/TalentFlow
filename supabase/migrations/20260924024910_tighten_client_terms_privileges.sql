revoke truncate, trigger, references, delete on table public.client_terms_documents from authenticated;
grant select, insert, update on table public.client_terms_documents to authenticated;

comment on table public.client_terms_documents is
'Vorlen-controlled client terms evidence. Authenticated access remains subject to manager-only RLS policies; destructive table-level privileges are not granted to authenticated users.';
