drop policy if exists "partner reactions add" on public.partner_message_reactions;
create policy "partner reactions add"
on public.partner_message_reactions
for insert
to authenticated
with check(
 user_id=(select auth.uid())
 and company_id=public.current_company_id()
 and private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and exists(
  select 1
  from public.partner_messages m
  where m.id=partner_message_reactions.message_id
   and m.conversation_id=partner_message_reactions.conversation_id
   and m.company_id=partner_message_reactions.company_id
   and m.deleted_at is null
 )
);

drop policy if exists "partner reactions update own" on public.partner_message_reactions;
create policy "partner reactions update own"
on public.partner_message_reactions
for update
to authenticated
using(
 user_id=(select auth.uid())
 and private.partner_chat_can_access(conversation_id,(select auth.uid()))
)
with check(
 user_id=(select auth.uid())
 and company_id=public.current_company_id()
 and private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and exists(
  select 1
  from public.partner_messages m
  where m.id=partner_message_reactions.message_id
   and m.conversation_id=partner_message_reactions.conversation_id
   and m.company_id=partner_message_reactions.company_id
   and m.deleted_at is null
 )
);
