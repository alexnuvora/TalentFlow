
alter table public.clients
  add column if not exists terms_send_reserved_until timestamptz;

create or replace function public.service_reserve_client_terms_send(
  p_client uuid,
  p_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_reserved boolean:=false;
begin
  if coalesce(auth.role(),'')<>'service_role' and current_user<>'service_role' then
    raise exception 'Service role required';
  end if;

  if p_seconds<30 or p_seconds>600 then
    raise exception 'Reservation must be between 30 and 600 seconds';
  end if;

  update public.clients
  set terms_send_reserved_until=now()+make_interval(secs=>p_seconds)
  where id=p_client
    and (
      terms_send_reserved_until is null
      or terms_send_reserved_until<=now()
    );

  v_reserved:=found;
  return v_reserved;
end
$$;

create or replace function public.service_release_client_terms_send(
  p_client uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if coalesce(auth.role(),'')<>'service_role' and current_user<>'service_role' then
    raise exception 'Service role required';
  end if;

  update public.clients
  set terms_send_reserved_until=null
  where id=p_client;
end
$$;

create or replace function public.service_finalize_client_terms_send(
  p_document uuid,
  p_resend_message_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_doc public.client_terms_documents%rowtype;
  v_now timestamptz:=now();
begin
  if coalesce(auth.role(),'')<>'service_role' and current_user<>'service_role' then
    raise exception 'Service role required';
  end if;

  select * into v_doc
  from public.client_terms_documents
  where id=p_document
  for update;

  if not found then
    raise exception 'Terms document not found';
  end if;

  if v_doc.status='sent' then
    update public.clients
    set terms_send_reserved_until=null
    where id=v_doc.client_id and company_id=v_doc.company_id;

    return jsonb_build_object(
      'ok',true,'document_id',v_doc.id,'sent_at',v_doc.sent_at,'idempotent',true
    );
  end if;

  if v_doc.status<>'draft' then
    raise exception 'Only a draft Terms of Business document can be finalised as sent';
  end if;

  perform 1
  from public.clients c
  where c.id=v_doc.client_id and c.company_id=v_doc.company_id
  for update;

  if not found then
    raise exception 'Client not found';
  end if;

  update public.client_terms_documents d
  set status='superseded',updated_at=v_now
  where d.company_id=v_doc.company_id
    and d.client_id=v_doc.client_id
    and d.id<>v_doc.id
    and d.status in ('draft','sent','viewed');

  update public.client_terms_documents
  set status='sent',
      sent_at=v_now,
      resend_message_id=nullif(btrim(coalesce(p_resend_message_id,'')),''),
      updated_at=v_now
  where id=v_doc.id;

  update public.clients
  set terms_send_reserved_until=null
  where id=v_doc.client_id and company_id=v_doc.company_id;

  return jsonb_build_object(
    'ok',true,'document_id',v_doc.id,'sent_at',v_now,'idempotent',false
  );
end
$$;

revoke all on function public.service_reserve_client_terms_send(uuid,integer)
from public,anon,authenticated;
revoke all on function public.service_release_client_terms_send(uuid)
from public,anon,authenticated;
revoke all on function public.service_finalize_client_terms_send(uuid,text)
from public,anon,authenticated;

grant execute on function public.service_reserve_client_terms_send(uuid,integer) to service_role;
grant execute on function public.service_release_client_terms_send(uuid) to service_role;
grant execute on function public.service_finalize_client_terms_send(uuid,text) to service_role;
