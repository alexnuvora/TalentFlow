
create or replace function public.partner_call_transcripts(p_client uuid)
returns table(id uuid,started_at timestamptz,ended_at timestamptz,summary text,transcript_text text)
language plpgsql stable security definer set search_path=''
as $$
begin
 if not private.partner_is_active(auth.uid()) or not private.partner_can_develop_clients(auth.uid()) or not private.partner_has_assigned_client(p_client,auth.uid()) then
   raise exception 'Assigned client-development access required';
 end if;
 return query
 select t.id,t.started_at,t.ended_at,t.summary,t.transcript_text
 from public.ai_call_transcripts t
 where t.company_id=private.current_company_id() and t.client_id=p_client
 order by coalesce(t.ended_at,t.started_at,t.created_at) desc
 limit 20;
end
$$;
revoke all on function public.partner_call_transcripts(uuid) from public,anon;
grant execute on function public.partner_call_transcripts(uuid) to authenticated;
