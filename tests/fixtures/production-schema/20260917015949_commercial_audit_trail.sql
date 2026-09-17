create table if not exists public.commercial_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('contract','placement')),
  entity_id uuid not null,
  action text not null check (action in ('created','updated','archived','duplicated','invoice_status_changed')),
  changed_by uuid default auth.uid(),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.commercial_audit_log enable row level security;
create policy "commercial audit tenant read" on public.commercial_audit_log for select to authenticated using (company_id = public.current_company_id());
create policy "commercial audit manager insert" on public.commercial_audit_log for insert to authenticated with check (public.is_manager() and company_id = public.current_company_id());
create index if not exists commercial_audit_entity_idx on public.commercial_audit_log(company_id, entity_type, entity_id, created_at desc);

create or replace function public.audit_commercial_change() returns trigger language plpgsql security invoker set search_path=public as $$
declare v_action text;
begin
  if tg_op='INSERT' then
    v_action := 'created';
    insert into public.commercial_audit_log(company_id,entity_type,entity_id,action,before_data,after_data)
    values(new.company_id,case when tg_table_name='client_contracts' then 'contract' else 'placement' end,new.id,v_action,null,to_jsonb(new));
    return new;
  end if;
  if tg_table_name='client_contracts' and old.status is distinct from new.status and new.status in ('expired','terminated') then v_action := 'archived';
  elsif tg_table_name='placements' and old.invoice_status is distinct from new.invoice_status then v_action := 'invoice_status_changed';
  else v_action := 'updated'; end if;
  insert into public.commercial_audit_log(company_id,entity_type,entity_id,action,before_data,after_data)
  values(new.company_id,case when tg_table_name='client_contracts' then 'contract' else 'placement' end,new.id,v_action,to_jsonb(old),to_jsonb(new));
  return new;
end;$$;
drop trigger if exists audit_client_contract_changes on public.client_contracts;
create trigger audit_client_contract_changes after insert or update on public.client_contracts for each row execute function public.audit_commercial_change();
drop trigger if exists audit_placement_changes on public.placements;
create trigger audit_placement_changes after insert or update on public.placements for each row execute function public.audit_commercial_change();
