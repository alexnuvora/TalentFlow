create or replace function public.service_accept_client_terms(
  p_document uuid,
  p_name text,
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_doc public.client_terms_documents%rowtype;
  v_now timestamptz:=now();
  v_contract uuid;
  v_ip inet;
begin
  if coalesce(auth.role(),'')<>'service_role' and current_user<>'service_role' then
    raise exception 'Service role required';
  end if;

  if nullif(btrim(p_name),'') is null or length(btrim(p_name))<2 then
    raise exception 'Name is required';
  end if;

  if nullif(btrim(coalesce(p_ip,'')),'') is not null then
    begin
      v_ip:=btrim(p_ip)::inet;
    exception when invalid_text_representation then
      v_ip:=null;
    end;
  end if;

  select * into v_doc
  from public.client_terms_documents
  where id=p_document
  for update;

  if not found then raise exception 'Terms document not found'; end if;
  if v_doc.token_expires_at is null or v_doc.token_expires_at<=v_now then
    raise exception 'This Terms of Business link has expired';
  end if;
  if v_doc.status not in ('sent','viewed') then
    raise exception 'These Terms of Business have already been completed or superseded';
  end if;

  update public.client_terms_documents
  set status='accepted',
      accepted_at=v_now,
      accepted_name=btrim(p_name),
      accepted_email=v_doc.recipient_email,
      acceptance_ip=v_ip,
      acceptance_user_agent=nullif(p_user_agent,''),
      acceptance_method='secure_link',
      updated_at=v_now
  where id=v_doc.id;

  update public.clients
  set terms_version=v_doc.version,
      terms_accepted_at=v_now,
      terms_accepted_by=btrim(p_name),
      terms_acceptance_method='secure_link',
      terms_evidence='Accepted secure Terms of Business document '||v_doc.id::text,
      status='active'
  where id=v_doc.client_id
    and company_id=v_doc.company_id;

  if not found then
    raise exception 'Client record could not be updated';
  end if;

  select cc.id into v_contract
  from public.client_contracts cc
  where cc.client_id=v_doc.client_id
    and cc.company_id=v_doc.company_id
    and cc.source_type='terms_acceptance'
    and cc.source_terms_accepted_at=v_now
  limit 1;

  return jsonb_build_object(
    'ok',true,
    'accepted_at',v_now,
    'version',v_doc.version,
    'contract_id',v_contract,
    'contract_status',(select status::text from public.client_contracts where id=v_contract)
  );
end
$function$;

revoke all on function public.service_accept_client_terms(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.service_accept_client_terms(uuid,text,text,text) to service_role;
