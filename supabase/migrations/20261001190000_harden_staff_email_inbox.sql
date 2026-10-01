-- Staff management inbox hardening and IONOS transport state.
alter table public.workspace_mailboxes
 add column if not exists imap_host text not null default 'imap.ionos.co.uk',
 add column if not exists imap_port integer not null default 993,
 add column if not exists smtp_host text not null default 'smtp.ionos.co.uk',
 add column if not exists smtp_port integer not null default 587,
 add column if not exists last_synced_at timestamptz,
 add column if not exists last_sync_error text,
 add column if not exists last_uid bigint not null default 0,
 add column if not exists is_active boolean not null default true;
alter table public.workspace_mailboxes alter column secret_id drop not null;
comment on column public.workspace_mailboxes.secret_id is 'Optional Vault reference. Production may instead use encrypted server environment credentials; plaintext mailbox passwords are never stored here.';
alter table public.staff_email_messages
 add column if not exists mailbox_email text,
 add column if not exists folder text not null default 'INBOX',
 add column if not exists imap_uid bigint,
 add column if not exists has_attachments boolean not null default false,
 add column if not exists raw_headers jsonb not null default '{}'::jsonb;
create unique index if not exists staff_email_messages_imap_uid_unique on public.staff_email_messages(company_id,mailbox_email,folder,imap_uid) where imap_uid is not null;
create index if not exists staff_email_threads_company_last_idx on public.staff_email_threads(company_id,is_archived,last_message_at desc);
create index if not exists staff_email_messages_thread_sent_idx on public.staff_email_messages(thread_id,sent_at);
create index if not exists staff_email_messages_unread_idx on public.staff_email_messages(company_id,is_read) where direction='inbound';
create table if not exists public.staff_email_audit(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,actor_id uuid references auth.users(id) on delete set null,action text not null,thread_id uuid references public.staff_email_threads(id) on delete set null,message_id uuid references public.staff_email_messages(id) on delete set null,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
alter table public.staff_email_audit enable row level security;
revoke all on public.staff_email_audit from anon,authenticated;
grant select on public.staff_email_audit to authenticated;
drop policy if exists staff_email_audit_manager_select on public.staff_email_audit;
create policy staff_email_audit_manager_select on public.staff_email_audit for select to authenticated using(company_id=private.current_company_id() and private.staff_email_allowed());
create or replace function public.staff_email_record_audit(p_action text,p_thread uuid default null,p_message uuid default null,p_metadata jsonb default '{}'::jsonb) returns void language plpgsql security definer set search_path='' as $$ declare c uuid:=private.current_company_id(); begin if not private.staff_email_allowed() then raise exception 'Manager access required'; end if; insert into public.staff_email_audit(company_id,actor_id,action,thread_id,message_id,metadata) values(c,auth.uid(),p_action,p_thread,p_message,coalesce(p_metadata,'{}'::jsonb)); end $$;
revoke all on function public.staff_email_record_audit(text,uuid,uuid,jsonb) from public,anon;grant execute on function public.staff_email_record_audit(text,uuid,uuid,jsonb) to authenticated;
revoke all on function public.staff_email_link_thread(uuid,uuid,uuid,uuid) from public,anon;grant execute on function public.staff_email_link_thread(uuid,uuid,uuid,uuid) to authenticated;
revoke all on function public.staff_email_set_thread_state(uuid,boolean,boolean,boolean) from public,anon;grant execute on function public.staff_email_set_thread_state(uuid,boolean,boolean,boolean) to authenticated;
