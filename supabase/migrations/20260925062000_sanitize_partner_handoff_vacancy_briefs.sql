
create or replace function public.sanitize_partner_handoff_job_brief()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_handoff uuid;
  v_hiring_need text;
begin
  if new.client_instruction_reference like 'partner_handoff:%' then
    begin
      v_handoff := split_part(new.client_instruction_reference,':',2)::uuid;
    exception when others then
      return new;
    end;

    select h.hiring_need into v_hiring_need
    from public.partner_commercial_handoffs h
    where h.id=v_handoff and h.company_id=new.company_id;

    if found and nullif(btrim(coalesce(v_hiring_need,'')),'') is not null then
      new.description := v_hiring_need;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_sanitize_partner_handoff_job_brief on public.jobs;
create trigger trg_sanitize_partner_handoff_job_brief
before insert or update of client_instruction_reference,description
on public.jobs
for each row execute function public.sanitize_partner_handoff_job_brief();

revoke all on function public.sanitize_partner_handoff_job_brief()
from public,anon,authenticated;

update public.jobs j
set description=h.hiring_need
from public.partner_commercial_handoffs h
where j.id=h.approved_job_id
  and h.status='converted'
  and j.client_instruction_reference='partner_handoff:'||h.id::text
  and nullif(btrim(coalesce(h.hiring_need,'')),'') is not null;
