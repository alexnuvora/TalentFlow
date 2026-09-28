grant delete on public.partner_message_attachments to authenticated;
drop policy if exists "partner attachments delete own recent" on public.partner_message_attachments;
create policy "partner attachments delete own recent" on public.partner_message_attachments
for delete to authenticated
using(
 uploaded_by=(select auth.uid())
 and private.partner_chat_can_access(conversation_id,(select auth.uid()))
 and exists(
   select 1 from public.partner_messages m
   where m.id=message_id
     and m.conversation_id=conversation_id
     and m.sender_id=(select auth.uid())
     and now()<=m.created_at+interval '15 minutes'
 )
);
