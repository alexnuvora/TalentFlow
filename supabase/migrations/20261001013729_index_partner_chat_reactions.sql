create index if not exists idx_partner_message_reactions_company_conversation
on public.partner_message_reactions(company_id,conversation_id);

create index if not exists idx_partner_message_reactions_user
on public.partner_message_reactions(user_id);
