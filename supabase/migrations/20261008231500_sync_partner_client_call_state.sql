-- Synchronize partner client call outcomes into the canonical client CRM record.
-- The partner activity/notes tables remain an audit/source layer, while public.clients
-- is the management-facing canonical summary used by CEO/manager client workspaces.

alter table public.partner_client_activity
  drop constraint if exists partner_client_activity_status_check;

alter table public.partner_client_activity
  add constraint partner_client_activity_status_check
  check (status = any (array[
    'not_contacted','no_answer','voicemail','wrong_number','contacted','busy',
    'not_interested','call_back','send_more_info','interested','follow_up',
    'meeting_booked','converted','do_not_contact'
  ]::text[]));

create or replace function private.sync_partner_client_activity_to_client()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_call_status public.client_call_status;
  v_attempt_inc integer := 0;
begin
  v_call_status := case new.status
    when 'not_contacted' then 'not_contacted'::public.client_call_status
    when 'no_answer' then 'no_answer'::public.client_call_status
    when 'voicemail' then 'voicemail'::public.client_call_status
    when 'wrong_number' then 'wrong_number'::public.client_call_status
    when 'busy' then 'busy'::public.client_call_status
    when 'call_back' then 'callback'::public.client_call_status
    when 'not_interested' then 'not_interested'::public.client_call_status
    when 'interested' then 'interested'::public.client_call_status
    when 'do_not_contact' then 'do_not_call'::public.client_call_status
    else 'contacted'::public.client_call_status
  end;

  if new.last_contacted_at is not null
     and (tg_op='INSERT' or old.last_contacted_at is distinct from new.last_contacted_at) then
    v_attempt_inc := 1;
  end if;

  update public.clients c
  set call_status = v_call_status,
      last_contacted_at = case
        when new.last_contacted_at is not null
          and (c.last_contacted_at is null or new.last_contacted_at >= c.last_contacted_at)
          then new.last_contacted_at
        else c.last_contacted_at
      end,
      next_call_at = case when new.status='call_back' then new.callback_at else null end,
      call_attempts = c.call_attempts + v_attempt_inc,
      last_call_outcome = new.status
  where c.id=new.client_id
    and c.company_id=new.company_id;

  return new;
end
$$;

revoke all on function private.sync_partner_client_activity_to_client() from public,anon,authenticated;

drop trigger if exists trg_sync_partner_client_activity_to_client on public.partner_client_activity;
create trigger trg_sync_partner_client_activity_to_client
after insert or update of status,callback_at,last_contacted_at
on public.partner_client_activity
for each row execute function private.sync_partner_client_activity_to_client();

create or replace function private.sync_partner_client_note_to_client()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.clients c
  set last_call_note=new.note
  where c.id=new.client_id
    and c.company_id=new.company_id;
  return new;
end
$$;

revoke all on function private.sync_partner_client_note_to_client() from public,anon,authenticated;

drop trigger if exists trg_sync_partner_client_note_to_client on public.partner_client_notes;
create trigger trg_sync_partner_client_note_to_client
after insert on public.partner_client_notes
for each row execute function private.sync_partner_client_note_to_client();

with latest_activity as (
  select distinct on (a.client_id)
    a.client_id,a.company_id,a.status,a.callback_at,a.last_contacted_at,a.updated_at
  from public.partner_client_activity a
  order by a.client_id,a.updated_at desc
)
update public.clients c
set call_status = case la.status
      when 'not_contacted' then 'not_contacted'::public.client_call_status
      when 'no_answer' then 'no_answer'::public.client_call_status
      when 'voicemail' then 'voicemail'::public.client_call_status
      when 'wrong_number' then 'wrong_number'::public.client_call_status
      when 'busy' then 'busy'::public.client_call_status
      when 'call_back' then 'callback'::public.client_call_status
      when 'not_interested' then 'not_interested'::public.client_call_status
      when 'interested' then 'interested'::public.client_call_status
      when 'do_not_contact' then 'do_not_call'::public.client_call_status
      else 'contacted'::public.client_call_status
    end,
    last_contacted_at = coalesce(greatest(c.last_contacted_at,la.last_contacted_at),c.last_contacted_at,la.last_contacted_at),
    next_call_at = case when la.status='call_back' then la.callback_at else null end,
    last_call_outcome = la.status
from latest_activity la
where c.id=la.client_id and c.company_id=la.company_id
  and (
    c.last_call_outcome is null
    or la.updated_at >= coalesce(c.last_contacted_at,'1970-01-01'::timestamptz)
  );

with latest_note as (
  select distinct on (n.client_id)
    n.client_id,n.company_id,n.note,n.created_at
  from public.partner_client_notes n
  order by n.client_id,n.created_at desc
)
update public.clients c
set last_call_note=ln.note
from latest_note ln
where c.id=ln.client_id and c.company_id=ln.company_id
  and (c.last_call_note is null or btrim(c.last_call_note)='');
