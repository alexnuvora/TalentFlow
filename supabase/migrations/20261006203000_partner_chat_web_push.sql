-- Production Web Push for Vorlen partner chat.
-- Runtime VAPID/private worker secrets are intentionally provisioned in Supabase Vault
-- and are NOT stored in source control:
--   vorlen_partner_chat_vapid_public
--   vorlen_partner_chat_vapid_private
--   vorlen_partner_chat_push_worker_secret

create table if not exists public.partner_chat_push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth_secret text not null,
 user_agent text,
 enabled boolean not null default true,
 failure_count integer not null default 0 check(failure_count>=0),
 last_success_at timestamptz,
 last_failure_at timestamptz,
 last_seen_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_partner_chat_push_subscriptions_user on public.partner_chat_push_subscriptions(user_id) where enabled;
create index if not exists idx_partner_chat_push_subscriptions_company on public.partner_chat_push_subscriptions(company_id) where enabled;
alter table public.partner_chat_push_subscriptions enable row level security;
revoke all on public.partner_chat_push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.partner_chat_push_subscriptions to service_role;
drop policy if exists "push subscriptions deny browser direct access" on public.partner_chat_push_subscriptions;
create policy "push subscriptions deny browser direct access" on public.partner_chat_push_subscriptions
 for all to authenticated using(false) with check(false);

create table if not exists public.partner_chat_push_events(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 message_id uuid not null unique references public.partner_messages(id) on delete cascade,
 conversation_id uuid not null references public.partner_conversations(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0 check(attempts>=0 and attempts<=10),
 next_attempt_at timestamptz not null default now(),
 processing_started_at timestamptz,
 sent_at timestamptz,
 sent_count integer not null default 0 check(sent_count>=0),
 failed_count integer not null default 0 check(failed_count>=0),
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_partner_chat_push_events_due on public.partner_chat_push_events(status,next_attempt_at)
 where status in ('pending','processing');
alter table public.partner_chat_push_events enable row level security;
revoke all on public.partner_chat_push_events from anon,authenticated;
grant select,insert,update,delete on public.partner_chat_push_events to service_role;
drop policy if exists "push events deny browser access" on public.partner_chat_push_events;
create policy "push events deny browser access" on public.partner_chat_push_events
 for all to authenticated using(false) with check(false);

create table if not exists public.partner_chat_push_deliveries(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.partner_chat_push_events(id) on delete cascade,
 subscription_id uuid not null references public.partner_chat_push_subscriptions(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','expired','failed')),
 attempts integer not null default 0 check(attempts>=0 and attempts<=10),
 next_attempt_at timestamptz not null default now(),
 processing_started_at timestamptz,
 sent_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(event_id,subscription_id)
);
create index if not exists idx_partner_chat_push_deliveries_due on public.partner_chat_push_deliveries(event_id,status,next_attempt_at)
 where status in ('pending','processing');
alter table public.partner_chat_push_deliveries enable row level security;
revoke all on public.partner_chat_push_deliveries from anon,authenticated;
grant select,insert,update,delete on public.partner_chat_push_deliveries to service_role;
drop policy if exists "push deliveries deny browser access" on public.partner_chat_push_deliveries;
create policy "push deliveries deny browser access" on public.partner_chat_push_deliveries
 for all to authenticated using(false) with check(false);

create or replace function public.register_partner_chat_push_subscription(
 p_endpoint text,p_p256dh text,p_auth_secret text,p_user_agent text default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=(select auth.uid());v_company uuid;v_role text;v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if length(coalesce(p_endpoint,''))<20 or length(coalesce(p_endpoint,''))>4096 then raise exception 'Invalid push endpoint'; end if;
 if length(coalesce(p_p256dh,''))<20 or length(coalesce(p_p256dh,''))>512 then raise exception 'Invalid push key'; end if;
 if length(coalesce(p_auth_secret,''))<8 or length(coalesce(p_auth_secret,''))>256 then raise exception 'Invalid push auth secret'; end if;
 select p.company_id,p.role::text into v_company,v_role from public.profiles p where p.id=v_user;
 if v_company is null or v_role not in ('owner','manager','partner') then raise exception 'Partner chat access required'; end if;
 insert into public.partner_chat_push_subscriptions(company_id,user_id,endpoint,p256dh,auth_secret,user_agent,enabled,failure_count,last_seen_at,updated_at)
 values(v_company,v_user,p_endpoint,p_p256dh,p_auth_secret,left(coalesce(p_user_agent,''),1000),true,0,now(),now())
 on conflict(endpoint) do update set company_id=excluded.company_id,user_id=excluded.user_id,p256dh=excluded.p256dh,
 auth_secret=excluded.auth_secret,user_agent=excluded.user_agent,enabled=true,failure_count=0,last_seen_at=now(),updated_at=now()
 where public.partner_chat_push_subscriptions.p256dh=excluded.p256dh
   and public.partner_chat_push_subscriptions.auth_secret=excluded.auth_secret
 returning id into v_id;
 if v_id is null then raise exception 'Push endpoint is already registered with different encryption keys'; end if;
 return v_id;
end$$;
revoke all on function public.register_partner_chat_push_subscription(text,text,text,text) from public,anon;
grant execute on function public.register_partner_chat_push_subscription(text,text,text,text) to authenticated;

create or replace function public.unregister_partner_chat_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=(select auth.uid());v_count integer;
begin
 if v_user is null then return false; end if;
 delete from public.partner_chat_push_subscriptions s where s.endpoint=p_endpoint and s.user_id=v_user;
 get diagnostics v_count=row_count;
 return v_count>0;
end$$;
revoke all on function public.unregister_partner_chat_push_subscription(text) from public,anon;
grant execute on function public.unregister_partner_chat_push_subscription(text) to authenticated;

create or replace function public.partner_chat_push_public_key()
returns text language sql stable security definer set search_path=''
as $$select s.decrypted_secret from vault.decrypted_secrets s
 where s.name='vorlen_partner_chat_vapid_public' order by s.created_at desc limit 1$$;
revoke all on function public.partner_chat_push_public_key() from public,anon;
grant execute on function public.partner_chat_push_public_key() to authenticated;

create or replace function public.partner_chat_push_vapid_keys()
returns table(public_key text,private_key text)
language sql stable security definer set search_path=''
as $$select
 (select s.decrypted_secret from vault.decrypted_secrets s where s.name='vorlen_partner_chat_vapid_public' order by s.created_at desc limit 1),
 (select s.decrypted_secret from vault.decrypted_secrets s where s.name='vorlen_partner_chat_vapid_private' order by s.created_at desc limit 1)$$;
revoke all on function public.partner_chat_push_vapid_keys() from public,anon,authenticated;
grant execute on function public.partner_chat_push_vapid_keys() to service_role;

create or replace function public.verify_partner_chat_push_worker_secret(p_secret text)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from vault.decrypted_secrets s
 where s.name='vorlen_partner_chat_push_worker_secret' and length(coalesce(p_secret,''))>=32 and s.decrypted_secret=p_secret)$$;
revoke all on function public.verify_partner_chat_push_worker_secret(text) from public,anon,authenticated;
grant execute on function public.verify_partner_chat_push_worker_secret(text) to service_role;

create or replace function public.claim_partner_chat_push_events(p_event_id uuid default null,p_limit integer default 25)
returns table(event_id uuid,message_id uuid,attempts integer)
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 for v_id in select e.id from public.partner_chat_push_events e
 where (p_event_id is null or e.id=p_event_id)
   and ((e.status='pending' and e.next_attempt_at<=now()) or (e.status='processing' and e.processing_started_at<now()-interval '2 minutes'))
   and e.attempts<5
 order by e.next_attempt_at,e.created_at for update skip locked
 limit greatest(1,least(coalesce(p_limit,25),100))
 loop
  update public.partner_chat_push_events e set status='processing',processing_started_at=now(),attempts=e.attempts+1,updated_at=now() where e.id=v_id;
  return query select e.id,e.message_id,e.attempts from public.partner_chat_push_events e where e.id=v_id;
 end loop;
 return;
end$$;
revoke all on function public.claim_partner_chat_push_events(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_partner_chat_push_events(uuid,integer) to service_role;

create or replace function private.dispatch_partner_chat_push(p_event_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_secret text;
begin
 select s.decrypted_secret into v_secret from vault.decrypted_secrets s
 where s.name='vorlen_partner_chat_push_worker_secret' order by s.created_at desc limit 1;
 if coalesce(v_secret,'')='' then return; end if;
 perform net.http_post(
  url:='https://mzkaodoruhklzluikagy.supabase.co/functions/v1/partner-chat-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-chat-push-secret',v_secret),
  body:=jsonb_build_object('event_id',p_event_id),timeout_milliseconds:=10000);
end$$;
revoke all on function private.dispatch_partner_chat_push(uuid) from public,anon,authenticated;

create or replace function private.queue_partner_chat_push_from_message()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_event uuid;
begin
 if new.deleted_at is not null or new.message_type='attachment' then return new; end if;
 insert into public.partner_chat_push_events(company_id,message_id,conversation_id)
 values(new.company_id,new.id,new.conversation_id) on conflict(message_id) do nothing returning id into v_event;
 if v_event is not null then perform private.dispatch_partner_chat_push(v_event); end if;
 return new;
end$$;
revoke all on function private.queue_partner_chat_push_from_message() from public,anon,authenticated;
drop trigger if exists trg_partner_chat_queue_push_from_message on public.partner_messages;
create trigger trg_partner_chat_queue_push_from_message after insert on public.partner_messages
 for each row execute function private.queue_partner_chat_push_from_message();

create or replace function private.queue_partner_chat_push_from_attachment()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_event uuid;v_message public.partner_messages%rowtype;
begin
 select * into v_message from public.partner_messages m where m.id=new.message_id;
 if v_message.id is null or v_message.deleted_at is not null then return new; end if;
 insert into public.partner_chat_push_events(company_id,message_id,conversation_id)
 values(v_message.company_id,v_message.id,v_message.conversation_id) on conflict(message_id) do nothing returning id into v_event;
 if v_event is not null then perform private.dispatch_partner_chat_push(v_event); end if;
 return new;
end$$;
revoke all on function private.queue_partner_chat_push_from_attachment() from public,anon,authenticated;
drop trigger if exists trg_partner_chat_queue_push_from_attachment on public.partner_message_attachments;
create trigger trg_partner_chat_queue_push_from_attachment after insert on public.partner_message_attachments
 for each row execute function private.queue_partner_chat_push_from_attachment();

do $$
declare v_job bigint;
begin
 for v_job in select jobid from cron.job where jobname='vorlen-partner-chat-push-retry' loop perform cron.unschedule(v_job); end loop;
 perform cron.schedule('vorlen-partner-chat-push-retry','* * * * *',$cron$
  select net.http_post(
   url:='https://mzkaodoruhklzluikagy.supabase.co/functions/v1/partner-chat-push',
   headers:=jsonb_build_object('Content-Type','application/json','x-chat-push-secret',
     coalesce((select decrypted_secret from vault.decrypted_secrets where name='vorlen_partner_chat_push_worker_secret' order by created_at desc limit 1),'')
   ),
   body:='{}'::jsonb,timeout_milliseconds:=15000);
 $cron$);
end$$;
