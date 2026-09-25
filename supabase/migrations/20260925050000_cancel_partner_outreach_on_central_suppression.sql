
-- Cancel open partner outreach immediately when a central suppression is recorded.

create or replace function public.cancel_partner_outreach_on_suppression()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.partner_tasks t
  set status='cancelled',
      completed_at=coalesce(t.completed_at,now())
  where t.company_id=new.company_id
    and t.client_id is not null
    and t.status not in ('done','cancelled')
    and exists(
      select 1
      from public.clients c
      where c.id=t.client_id
        and c.company_id=new.company_id
        and (
          (new.client_id is not null and c.id=new.client_id)
          or (
            new.email_normalized is not null
            and lower(btrim(coalesce(c.email,'')))=new.email_normalized
          )
          or (
            new.phone_normalized is not null
            and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')=new.phone_normalized
          )
        )
    );

  update public.partner_client_sequences s
  set status='cancelled',
      completed_at=coalesce(s.completed_at,now())
  where s.company_id=new.company_id
    and s.status in ('active','completed')
    and exists(
      select 1
      from public.clients c
      where c.id=s.client_id
        and c.company_id=new.company_id
        and (
          (new.client_id is not null and c.id=new.client_id)
          or (
            new.email_normalized is not null
            and lower(btrim(coalesce(c.email,'')))=new.email_normalized
          )
          or (
            new.phone_normalized is not null
            and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')=new.phone_normalized
          )
        )
    );

  return new;
end
$$;

drop trigger if exists trg_cancel_partner_outreach_on_suppression on public.b2b_call_suppressions;
create trigger trg_cancel_partner_outreach_on_suppression
after insert or update of client_id,email_normalized,phone_normalized
on public.b2b_call_suppressions
for each row execute function public.cancel_partner_outreach_on_suppression();

revoke all on function public.cancel_partner_outreach_on_suppression()
from public,anon,authenticated;
