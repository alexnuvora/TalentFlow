create index if not exists idx_partner_conversations_partner on public.partner_conversations(partner_id);
create index if not exists idx_partner_messages_company_conversation on public.partner_messages(company_id,conversation_id);
create index if not exists idx_partner_messages_reply_to on public.partner_messages(reply_to_id) where reply_to_id is not null;
create index if not exists idx_partner_messages_pinned_by on public.partner_messages(pinned_by) where pinned_by is not null;
create index if not exists idx_partner_message_attachments_company_conversation on public.partner_message_attachments(company_id,conversation_id);
create index if not exists idx_partner_message_attachments_uploaded_by on public.partner_message_attachments(uploaded_by);
create index if not exists idx_partner_message_receipts_user on public.partner_message_receipts(user_id);
create index if not exists idx_partner_chat_user_state_user on public.partner_chat_user_state(user_id);
