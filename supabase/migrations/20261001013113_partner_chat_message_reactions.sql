create table if not exists public.partner_message_reactions(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 conversation_id uuid not null references public.partner_conversations(id) on delete cascade,
 message_id uuid not null references public.partner_messages(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 emoji text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint partner_message_reactions_one_per_user unique(message_id,user_id),
 constraint partner_message_reactions_emoji check(emoji in ('👍','❤️','😂','😮','😢','🙏')),
 constraint partner_message_reactions_message_scope foreign key(company_id,conversation_id) references public.partner_conversations(company_id,id) on delete cascade
);

create index if not exists idx_partner_message_reactions_conversation on public.partner_message_reactions(conversation_id,message_id);
create index if not exists idx_partner_message_reactions_message on public.partner_message_reactions(message_id);

alter table public.partner_message_reactions enable row level security;

grant select,insert,update,delete on public.partner_message_reactions to authenticated;

drop policy if exists "partner reactions read" on public.partner_message_reactions;
create policy "partner reactions read" on public.partner_message_reactions
for select to authenticated
using(private.partner_chat_can_access(conversation_id,(select auth.uid())));

drop policy if exists "partner reactions add" on public.partner_message_reactions;
create policy "partner reactions add" on public.partner_message_reactions
for insert to authenticated
with check(
 user_id=(select auth.uid())
 and company_id=public.current_company_id()
 and private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and exists(select 1 from public.partner_messages m where m.id=partner_message_reactions.message_id and m.conversation_id=partner_message_reactions.conversation_id and m.company_id=partner_message_reactions.company_id and m.deleted_at is null)
);

drop policy if exists "partner reactions update own" on public.partner_message_reactions;
create policy "partner reactions update own" on public.partner_message_reactions
for update to authenticated
using(user_id=(select auth.uid()) and private.partner_chat_can_access(conversation_id,(select auth.uid())))
with check(
 user_id=(select auth.uid())
 and company_id=public.current_company_id()
 and private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and exists(select 1 from public.partner_messages m where m.id=partner_message_reactions.message_id and m.conversation_id=partner_message_reactions.conversation_id and m.company_id=partner_message_reactions.company_id and m.deleted_at is null)
);

drop policy if exists "partner reactions delete own" on public.partner_message_reactions;
create policy "partner reactions delete own" on public.partner_message_reactions
for delete to authenticated
using(user_id=(select auth.uid()) and private.partner_chat_can_access(conversation_id,(select auth.uid())));

create or replace function private.partner_message_reaction_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if tg_op='UPDATE' then
  if new.company_id<>old.company_id or new.conversation_id<>old.conversation_id or new.message_id<>old.message_id or new.user_id<>old.user_id or new.created_at<>old.created_at then
   raise exception 'Reaction identity fields are immutable';
  end if;
  new.updated_at:=now();
 end if;
 if not private.partner_chat_can_access(new.conversation_id,(select auth.uid())) then raise exception 'Conversation access required'; end if;
 if not exists(select 1 from public.partner_messages m where m.id=new.message_id and m.conversation_id=new.conversation_id and m.company_id=new.company_id and m.deleted_at is null) then
  raise exception 'Reaction target is not an active message in this conversation';
 end if;
 return new;
end
$$;

revoke all on function private.partner_message_reaction_guard() from public,anon,authenticated;

drop trigger if exists trg_partner_message_reaction_guard on public.partner_message_reactions;
create trigger trg_partner_message_reaction_guard
before insert or update on public.partner_message_reactions
for each row execute function private.partner_message_reaction_guard();

do $$
begin
 alter publication supabase_realtime add table public.partner_message_reactions;
exception when duplicate_object then null;
end
$$;
