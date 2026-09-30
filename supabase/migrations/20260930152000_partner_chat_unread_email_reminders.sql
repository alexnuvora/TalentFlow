create table if not exists public.partner_chat_email_reminders(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 message_id uuid not null unique references public.partner_messages(id) on delete cascade,
 conversation_id uuid not null references public.partner_conversations(id) on delete cascade,
 partner_id uuid not null references public.profiles(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete restrict,
 due_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','cancelled','failed')),
 attempts integer not null default 0 check(attempts>=0 and attempts<=10),
 processing_started_at timestamptz,
 sent_at timestamptz,
 cancelled_at timestamptz,
 provider_message_id text,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_partner_chat_email_reminders_due on public.partner_chat_email_reminders(status,due_at) where status in ('pending','processing');
create index if not exists idx_partner_chat_email_reminders_partner on public.partner_chat_email_reminders(partner_id,created_at desc);
create index if not exists idx_partner_chat_email_reminders_conversation on public.partner_chat_email_reminders(conversation_id,created_at desc);

alter table public.partner_chat_email_reminders enable row level security;
revoke all on public.partner_chat_email_reminders from anon,authenticated;
grant select,insert,update,delete on public.partner_chat_email_reminders to service_role;

create or replace function private.queue_partner_chat_email_reminder()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
 v_partner uuid;
 v_company uuid;
 v_sender_role text;
 v_partner_role text;
 v_partner_active boolean;
begin
 if new.deleted_at is not null then return new; end if;
 select c.partner_id,c.company_id into v_partner,v_company
 from public.partner_conversations c where c.id=new.conversation_id;
 if v_partner is null or v_company is null then return new; end if;

 select p.role::text into v_sender_role
 from public.profiles p where p.id=new.sender_id and p.company_id=v_company;

 select p.role::text into v_partner_role
 from public.profiles p where p.id=v_partner and p.company_id=v_company;

 select exists(
  select 1 from public.partner_onboarding o
  where o.partner_id=v_partner and o.company_id=v_company and o.status='active'
 ) into v_partner_active;

 if v_sender_role in ('owner','manager') and v_partner_role='partner' and v_partner_active and new.sender_id<>v_partner then
  insert into public.partner_chat_email_reminders(company_id,message_id,conversation_id,partner_id,sender_id,due_at)
  values(v_company,new.id,new.conversation_id,v_partner,new.sender_id,new.created_at+interval '1 hour')
  on conflict(message_id) do nothing;
 end if;
 return new;
end
$$;
revoke all on function private.queue_partner_chat_email_reminder() from public,anon,authenticated;

drop trigger if exists trg_partner_chat_queue_email_reminder on public.partner_messages;
create trigger trg_partner_chat_queue_email_reminder
after insert on public.partner_messages
for each row execute function private.queue_partner_chat_email_reminder();

create or replace function private.cancel_partner_chat_email_reminder_on_read()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
 if new.read_at is not null and (tg_op='INSERT' or old.read_at is distinct from new.read_at) then
  update public.partner_chat_email_reminders r
  set status='cancelled',cancelled_at=coalesce(r.cancelled_at,new.read_at),processing_started_at=null,updated_at=now()
  where r.message_id=new.message_id
    and r.partner_id=new.user_id
    and r.status in ('pending','processing');
 end if;
 return new;
end
$$;
revoke all on function private.cancel_partner_chat_email_reminder_on_read() from public,anon,authenticated;

drop trigger if exists trg_partner_chat_cancel_email_reminder_on_read on public.partner_message_receipts;
create trigger trg_partner_chat_cancel_email_reminder_on_read
after insert or update of read_at on public.partner_message_receipts
for each row execute function private.cancel_partner_chat_email_reminder_on_read();

create or replace function public.claim_partner_chat_email_reminders(p_limit integer default 25)
returns setof uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
 for v_id in
  select r.id
  from public.partner_chat_email_reminders r
  where (
    (r.status='pending' and r.due_at<=now())
    or (r.status='processing' and r.processing_started_at<now()-interval '15 minutes')
  )
    and r.attempts<5
  order by r.due_at
  for update skip locked
  limit greatest(1,least(coalesce(p_limit,25),100))
 loop
  update public.partner_chat_email_reminders
  set status='processing',processing_started_at=now(),updated_at=now()
  where id=v_id;
  return next v_id;
 end loop;
 return;
end
$$;
revoke all on function public.claim_partner_chat_email_reminders(integer) from public,anon,authenticated;
grant execute on function public.claim_partner_chat_email_reminders(integer) to service_role;

do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='vorlen_partner_chat_reminder_cron_secret') then
  perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'vorlen_partner_chat_reminder_cron_secret','Vorlen partner chat unread reminder cron secret');
 end if;
end $$;

create or replace function public.verify_partner_chat_reminder_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select exists(
  select 1 from vault.decrypted_secrets s
  where s.name='vorlen_partner_chat_reminder_cron_secret'
    and length(coalesce(p_secret,''))>=32
    and s.decrypted_secret=p_secret
 );
$$;
revoke all on function public.verify_partner_chat_reminder_secret(text) from public,anon,authenticated;
grant execute on function public.verify_partner_chat_reminder_secret(text) to service_role;

select cron.schedule(
 'vorlen-partner-chat-unread-reminders',
 '* * * * *',
 $cron$
 select net.http_post(
   url:='https://mzkaodoruhklzluikagy.supabase.co/functions/v1/partner-chat-reminders',
   headers:=jsonb_build_object(
     'Content-Type','application/json',
     'x-chat-reminder-secret',(select decrypted_secret from vault.decrypted_secrets where name='vorlen_partner_chat_reminder_cron_secret' order by created_at desc limit 1)
   ),
   body:='{}'::jsonb,
   timeout_milliseconds:=15000
 );
 $cron$
);
