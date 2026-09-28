-- Partner <-> Vorlen management live chat
-- Live schema applied to Supabase as migration 20260928063302.
create table if not exists public.partner_conversations(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 partner_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 last_message_at timestamptz,
 unique(company_id,partner_id)
);
create unique index if not exists tenant_key_partner_conversations on public.partner_conversations(company_id,id);
create index if not exists idx_partner_conversations_last_message on public.partner_conversations(company_id,last_message_at desc nulls last);

create table if not exists public.partner_messages(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 conversation_id uuid not null,
 sender_id uuid not null references public.profiles(id) on delete restrict,
 body text not null default '',
 message_type text not null default 'text' check(message_type in('text','attachment','system')),
 reply_to_id uuid references public.partner_messages(id) on delete set null,
 context_type text check(context_type is null or context_type in('client','job','candidate','application','submission','handoff','placement','commission','task')),
 context_id uuid,
 context_label text,
 context_path text,
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 deleted_at timestamptz,
 pinned_at timestamptz,
 pinned_by uuid references public.profiles(id) on delete set null,
 constraint partner_messages_body_length check(char_length(body)<=8000),
 constraint partner_messages_context_path check(context_path is null or(context_path like '/dashboard/%' and char_length(context_path)<=500)),
 constraint partner_messages_conversation_fk foreign key(company_id,conversation_id) references public.partner_conversations(company_id,id) on delete cascade
);
create index if not exists idx_partner_messages_conversation_created on public.partner_messages(conversation_id,created_at desc);
create index if not exists idx_partner_messages_context on public.partner_messages(company_id,context_type,context_id) where context_id is not null;
create index if not exists idx_partner_messages_sender on public.partner_messages(sender_id,created_at desc);

create table if not exists public.partner_message_attachments(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 conversation_id uuid not null,
 message_id uuid not null references public.partner_messages(id) on delete cascade,
 uploaded_by uuid not null references public.profiles(id) on delete restrict,
 storage_path text not null unique,
 filename text not null,
 mime_type text not null,
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=10485760),
 created_at timestamptz not null default now(),
 constraint partner_message_attachments_conversation_fk foreign key(company_id,conversation_id) references public.partner_conversations(company_id,id) on delete cascade
);
create index if not exists idx_partner_message_attachments_message on public.partner_message_attachments(message_id);

create table if not exists public.partner_message_receipts(
 message_id uuid not null references public.partner_messages(id) on delete cascade,
 conversation_id uuid not null references public.partner_conversations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 delivered_at timestamptz not null default now(),
 read_at timestamptz,
 primary key(message_id,user_id)
);
create index if not exists idx_partner_message_receipts_conversation on public.partner_message_receipts(conversation_id,user_id,read_at);

create table if not exists public.partner_chat_user_state(
 conversation_id uuid not null references public.partner_conversations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 last_seen_at timestamptz not null default now(),
 typing_until timestamptz,
 updated_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);

create table if not exists public.partner_message_audit(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 conversation_id uuid not null,
 message_id uuid not null,
 actor_id uuid,
 action text not null check(action in('edited','deleted','pinned','unpinned')),
 old_body text,
 new_body text,
 created_at timestamptz not null default now()
);
create index if not exists idx_partner_message_audit_message on public.partner_message_audit(message_id,created_at desc);

alter table public.partner_conversations enable row level security;
alter table public.partner_messages enable row level security;
alter table public.partner_message_attachments enable row level security;
alter table public.partner_message_receipts enable row level security;
alter table public.partner_chat_user_state enable row level security;
alter table public.partner_message_audit enable row level security;

grant select,insert on public.partner_conversations to authenticated;
grant select,insert,update on public.partner_messages to authenticated;
grant select,insert,delete on public.partner_message_attachments to authenticated;
grant select,insert,update on public.partner_message_receipts to authenticated;
grant select,insert,update on public.partner_chat_user_state to authenticated;
grant select on public.partner_message_audit to authenticated;

create or replace function private.partner_chat_can_access(p_conversation uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(
 select 1 from public.partner_conversations c
 join public.profiles p on p.id=p_user and p.company_id=c.company_id
 where c.id=p_conversation and(c.partner_id=p_user or p.role in('owner','manager'))
)$$;
revoke all on function private.partner_chat_can_access(uuid,uuid) from public,anon;
grant execute on function private.partner_chat_can_access(uuid,uuid) to authenticated;

drop policy if exists "partner chat conversations read" on public.partner_conversations;
create policy "partner chat conversations read" on public.partner_conversations for select to authenticated
using(private.partner_chat_can_access(id,(select auth.uid())));
drop policy if exists "partner can create own chat" on public.partner_conversations;
create policy "partner can create own chat" on public.partner_conversations for insert to authenticated
with check(partner_id=(select auth.uid()) and company_id=public.current_company_id()
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_id and p.role='partner'));

drop policy if exists "partner messages read" on public.partner_messages;
create policy "partner messages read" on public.partner_messages for select to authenticated
using(private.partner_chat_can_access(conversation_id,(select auth.uid())));
drop policy if exists "partner messages send" on public.partner_messages;
create policy "partner messages send" on public.partner_messages for insert to authenticated
with check(sender_id=(select auth.uid()) and company_id=public.current_company_id() and private.partner_chat_can_access(conversation_id,(select auth.uid())));
drop policy if exists "partner messages update" on public.partner_messages;
create policy "partner messages update" on public.partner_messages for update to authenticated
using(private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and(sender_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_id and p.role in('owner','manager'))))
with check(private.partner_chat_can_access(conversation_id,(select auth.uid())));

drop policy if exists "partner attachments read" on public.partner_message_attachments;
create policy "partner attachments read" on public.partner_message_attachments for select to authenticated
using(private.partner_chat_can_access(conversation_id,(select auth.uid())));
drop policy if exists "partner attachments add" on public.partner_message_attachments;
create policy "partner attachments add" on public.partner_message_attachments for insert to authenticated
with check(uploaded_by=(select auth.uid()) and company_id=public.current_company_id()
 and private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and exists(select 1 from public.partner_messages m where m.id=message_id and m.conversation_id=conversation_id and m.sender_id=(select auth.uid()) and m.deleted_at is null));

drop policy if exists "partner attachments delete own recent" on public.partner_message_attachments;
create policy "partner attachments delete own recent" on public.partner_message_attachments for delete to authenticated
using(
 uploaded_by=(select auth.uid())
 and private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and exists(select 1 from public.partner_messages m where m.id=message_id and m.conversation_id=conversation_id and m.sender_id=(select auth.uid()) and now()<=m.created_at+interval '15 minutes')
);

drop policy if exists "partner receipts read" on public.partner_message_receipts;
create policy "partner receipts read" on public.partner_message_receipts for select to authenticated
using(private.partner_chat_can_access(conversation_id,(select auth.uid())));
drop policy if exists "partner receipts own insert" on public.partner_message_receipts;
create policy "partner receipts own insert" on public.partner_message_receipts for insert to authenticated
with check(user_id=(select auth.uid()) and private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and exists(select 1 from public.partner_messages m where m.id=message_id and m.conversation_id=conversation_id and m.sender_id<>(select auth.uid())));
drop policy if exists "partner receipts own update" on public.partner_message_receipts;
create policy "partner receipts own update" on public.partner_message_receipts for update to authenticated
using(user_id=(select auth.uid()) and private.partner_chat_can_access(conversation_id,(select auth.uid())))
with check(user_id=(select auth.uid()) and private.partner_chat_can_access(conversation_id,(select auth.uid())));

drop policy if exists "partner chat state read" on public.partner_chat_user_state;
create policy "partner chat state read" on public.partner_chat_user_state for select to authenticated
using(private.partner_chat_can_access(conversation_id,(select auth.uid())));
drop policy if exists "partner chat state own insert" on public.partner_chat_user_state;
create policy "partner chat state own insert" on public.partner_chat_user_state for insert to authenticated
with check(user_id=(select auth.uid()) and private.partner_chat_can_access(conversation_id,(select auth.uid())));
drop policy if exists "partner chat state own update" on public.partner_chat_user_state;
create policy "partner chat state own update" on public.partner_chat_user_state for update to authenticated
using(user_id=(select auth.uid()) and private.partner_chat_can_access(conversation_id,(select auth.uid())))
with check(user_id=(select auth.uid()) and private.partner_chat_can_access(conversation_id,(select auth.uid())));

drop policy if exists "partner message audit manager read" on public.partner_message_audit;
create policy "partner message audit manager read" on public.partner_message_audit for select to authenticated
using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_id and p.role in('owner','manager')));

create or replace function private.partner_chat_message_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_role text;v_uid uuid:=(select auth.uid());
begin
 if v_uid is null then raise exception 'Authentication required';end if;
 select p.role::text into v_role from public.profiles p where p.id=v_uid and p.company_id=old.company_id;
 if v_role is null then raise exception 'Workspace access required';end if;
 if new.company_id<>old.company_id or new.conversation_id<>old.conversation_id or new.sender_id<>old.sender_id or new.created_at<>old.created_at
  or new.reply_to_id is distinct from old.reply_to_id or new.context_type is distinct from old.context_type or new.context_id is distinct from old.context_id
  or new.context_label is distinct from old.context_label or new.context_path is distinct from old.context_path or new.message_type<>old.message_type
 then raise exception 'Immutable message fields cannot be changed';end if;
 if old.sender_id=v_uid then
  if(new.body is distinct from old.body or new.deleted_at is distinct from old.deleted_at) and now()>old.created_at+interval '15 minutes' then raise exception 'Messages can only be edited or deleted within 15 minutes';end if;
  if old.deleted_at is not null and(new.body is distinct from old.body or new.deleted_at is distinct from old.deleted_at) then raise exception 'Deleted messages cannot be edited';end if;
  if new.body is distinct from old.body and new.deleted_at is null then new.edited_at:=now();end if;
  if new.deleted_at is not null and old.deleted_at is null then new.body:='';end if;
 else
  if v_role not in('owner','manager') then raise exception 'Only the sender may change this message';end if;
  if new.body is distinct from old.body or new.deleted_at is distinct from old.deleted_at or new.edited_at is distinct from old.edited_at then raise exception 'Managers may only pin or unpin another user message';end if;
 end if;
 if new.pinned_at is distinct from old.pinned_at or new.pinned_by is distinct from old.pinned_by then
  if v_role not in('owner','manager') then raise exception 'Only Vorlen management may pin messages';end if;
  if new.pinned_at is null then new.pinned_by:=null;else new.pinned_by:=v_uid;new.pinned_at:=coalesce(new.pinned_at,now());end if;
 end if;
 return new;
end$$;
revoke all on function private.partner_chat_message_guard() from public,anon,authenticated;

create or replace function private.partner_chat_message_audit()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.body is distinct from old.body and new.deleted_at is null then insert into public.partner_message_audit(company_id,conversation_id,message_id,actor_id,action,old_body,new_body) values(old.company_id,old.conversation_id,old.id,(select auth.uid()),'edited',old.body,new.body);end if;
 if new.deleted_at is not null and old.deleted_at is null then insert into public.partner_message_audit(company_id,conversation_id,message_id,actor_id,action,old_body,new_body) values(old.company_id,old.conversation_id,old.id,(select auth.uid()),'deleted',old.body,null);end if;
 if new.pinned_at is distinct from old.pinned_at then insert into public.partner_message_audit(company_id,conversation_id,message_id,actor_id,action,old_body,new_body) values(old.company_id,old.conversation_id,old.id,(select auth.uid()),case when new.pinned_at is null then 'unpinned' else 'pinned' end,old.body,new.body);end if;
 return new;
end$$;
revoke all on function private.partner_chat_message_audit() from public,anon,authenticated;

create or replace function private.partner_chat_message_insert_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.sender_id is distinct from(select auth.uid()) then raise exception 'Invalid message sender';end if;
 if not private.partner_chat_can_access(new.conversation_id,(select auth.uid())) then raise exception 'Conversation access required';end if;
 select c.company_id into new.company_id from public.partner_conversations c where c.id=new.conversation_id;
 if new.reply_to_id is not null and not exists(select 1 from public.partner_messages m where m.id=new.reply_to_id and m.conversation_id=new.conversation_id) then raise exception 'Reply target is not in this conversation';end if;
 new.body:=btrim(coalesce(new.body,''));
 if new.body='' and new.message_type='text' then raise exception 'Message cannot be empty';end if;
 if new.context_label is not null then new.context_label:=left(btrim(new.context_label),240);end if;
 return new;
end$$;
revoke all on function private.partner_chat_message_insert_guard() from public,anon,authenticated;

create or replace function private.partner_chat_touch_conversation()
returns trigger language plpgsql security definer set search_path=''
as $$begin update public.partner_conversations set last_message_at=new.created_at where id=new.conversation_id;return new;end$$;
revoke all on function private.partner_chat_touch_conversation() from public,anon,authenticated;

create or replace function private.ensure_partner_conversation()
returns trigger language plpgsql security definer set search_path=''
as $$begin if new.role::text='partner' then insert into public.partner_conversations(company_id,partner_id) values(new.company_id,new.id) on conflict(company_id,partner_id) do nothing;end if;return new;end$$;
revoke all on function private.ensure_partner_conversation() from public,anon,authenticated;

drop trigger if exists trg_partner_chat_message_guard on public.partner_messages;
create trigger trg_partner_chat_message_guard before update on public.partner_messages for each row execute function private.partner_chat_message_guard();
drop trigger if exists trg_partner_chat_message_audit on public.partner_messages;
create trigger trg_partner_chat_message_audit after update on public.partner_messages for each row execute function private.partner_chat_message_audit();
drop trigger if exists trg_partner_chat_message_insert_guard on public.partner_messages;
create trigger trg_partner_chat_message_insert_guard before insert on public.partner_messages for each row execute function private.partner_chat_message_insert_guard();
drop trigger if exists trg_partner_chat_touch_conversation on public.partner_messages;
create trigger trg_partner_chat_touch_conversation after insert on public.partner_messages for each row execute function private.partner_chat_touch_conversation();
drop trigger if exists trg_ensure_partner_conversation on public.profiles;
create trigger trg_ensure_partner_conversation after insert or update of role,company_id on public.profiles for each row execute function private.ensure_partner_conversation();

insert into public.partner_conversations(company_id,partner_id)
select p.company_id,p.id from public.profiles p where p.role='partner'
on conflict(company_id,partner_id) do nothing;

create or replace function public.partner_chat_unread_count()
returns bigint language sql stable security invoker set search_path=''
as $$select count(*) from public.partner_messages m join public.partner_conversations c on c.id=m.conversation_id
where private.partner_chat_can_access(c.id,(select auth.uid())) and m.sender_id<>(select auth.uid()) and m.deleted_at is null
and not exists(select 1 from public.partner_message_receipts r where r.message_id=m.id and r.user_id=(select auth.uid()) and r.read_at is not null)$$;
grant execute on function public.partner_chat_unread_count() to authenticated;

create or replace function public.partner_chat_list()
returns table(conversation_id uuid,partner_id uuid,partner_name text,specialism text,partner_active boolean,last_message_at timestamptz,last_message text,last_sender_id uuid,unread_count bigint,partner_last_seen_at timestamptz)
language sql stable security invoker set search_path=''
as $$
select c.id,c.partner_id,p.full_name,pp.specialism,coalesce(pp.active,false),c.last_message_at,
 case when lm.deleted_at is not null then 'Message deleted' when lm.message_type='attachment' and lm.body='' then 'Attachment' else left(lm.body,180) end,
 lm.sender_id,
 (select count(*) from public.partner_messages um where um.conversation_id=c.id and um.sender_id<>(select auth.uid()) and um.deleted_at is null
   and not exists(select 1 from public.partner_message_receipts r where r.message_id=um.id and r.user_id=(select auth.uid()) and r.read_at is not null)),
 (select s.last_seen_at from public.partner_chat_user_state s where s.conversation_id=c.id and s.user_id=c.partner_id)
from public.partner_conversations c
join public.profiles p on p.id=c.partner_id
left join public.partner_profiles pp on pp.user_id=c.partner_id and pp.company_id=c.company_id
left join lateral(select m.body,m.sender_id,m.deleted_at,m.message_type from public.partner_messages m where m.conversation_id=c.id order by m.created_at desc limit 1)lm on true
where c.company_id=public.current_company_id()
 and exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.company_id=c.company_id and me.role in('owner','manager'))
order by c.last_message_at desc nulls last,p.full_name
$$;
grant execute on function public.partner_chat_list() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('partner-chat','partner-chat',false,10485760,array[
'image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "partner chat storage read" on storage.objects;
create policy "partner chat storage read" on storage.objects for select to authenticated using(
 bucket_id='partner-chat' and case when coalesce((storage.foldername(name))[2],'')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 then private.partner_chat_can_access(((storage.foldername(name))[2])::uuid,(select auth.uid())) else false end);
drop policy if exists "partner chat storage upload" on storage.objects;
create policy "partner chat storage upload" on storage.objects for insert to authenticated with check(
 bucket_id='partner-chat' and owner_id=(select auth.uid())::text and(storage.foldername(name))[1]=public.current_company_id()::text
 and case when coalesce((storage.foldername(name))[2],'')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 then private.partner_chat_can_access(((storage.foldername(name))[2])::uuid,(select auth.uid())) else false end);
drop policy if exists "partner chat storage delete own" on storage.objects;
create policy "partner chat storage delete own" on storage.objects for delete to authenticated using(
 bucket_id='partner-chat' and owner_id=(select auth.uid())::text
 and case when coalesce((storage.foldername(name))[2],'')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 then private.partner_chat_can_access(((storage.foldername(name))[2])::uuid,(select auth.uid())) else false end);

do $$begin alter publication supabase_realtime add table public.partner_messages;exception when duplicate_object then null;end$$;
do $$begin alter publication supabase_realtime add table public.partner_message_receipts;exception when duplicate_object then null;end$$;
do $$begin alter publication supabase_realtime add table public.partner_chat_user_state;exception when duplicate_object then null;end$$;
