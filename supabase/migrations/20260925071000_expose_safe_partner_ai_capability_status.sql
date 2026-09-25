
create or replace function public.partner_ai_capability_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_ready boolean;
begin
  if auth.uid() is null or not private.partner_is_active(auth.uid()) then
    raise exception 'Active partner access required';
  end if;

  select public.ai_governance_ready(v_company) into v_ready;

  return jsonb_build_object(
    'enabled',coalesce(v_ready,false),
    'reason',case when coalesce(v_ready,false)
      then null
      else 'AI tools remain gated until Vorlen management completes and approves the AI governance checkpoint.'
    end
  );
end
$$;

revoke all on function public.partner_ai_capability_status() from public,anon;
grant execute on function public.partner_ai_capability_status() to authenticated;
