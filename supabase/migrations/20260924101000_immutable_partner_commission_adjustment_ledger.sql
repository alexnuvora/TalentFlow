create table if not exists public.partner_commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  base_commission_id uuid not null references public.partner_commissions(id) on delete cascade,
  placement_id uuid not null references public.placements(id) on delete cascade,
  partner_user_id uuid references auth.users(id) on delete set null,
  agreement_id uuid references public.partner_agreements(id),
  source_invoice_id uuid references public.invoices(id),
  eligible_fee_delta numeric not null default 0,
  amount numeric not null default 0,
  status text not null default 'accrued' check (status in ('accrued','approved','paid','void')),
  reason text not null default 'Post-approval commission adjustment',
  approved_at timestamptz,approved_by uuid references auth.users(id),paid_at timestamptz,payment_reference text,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists partner_commission_adjustments_partner_idx on public.partner_commission_adjustments(partner_user_id,created_at desc);
create index if not exists partner_commission_adjustments_company_status_idx on public.partner_commission_adjustments(company_id,status);
create unique index if not exists partner_commission_adjustments_open_uq on public.partner_commission_adjustments(base_commission_id) where status='accrued';
alter table public.partner_commission_adjustments enable row level security;
create policy "commission adjustments read own or managers" on public.partner_commission_adjustments for select to authenticated using (company_id=private.current_company_id() and (partner_user_id=auth.uid() or private.is_manager()));
create policy "commission adjustments managers insert" on public.partner_commission_adjustments for insert to authenticated with check (company_id=private.current_company_id() and private.is_manager());
create policy "commission adjustments managers update" on public.partner_commission_adjustments for update to authenticated using (company_id=private.current_company_id() and private.is_manager()) with check (company_id=private.current_company_id() and private.is_manager());
create policy "commission adjustments managers delete" on public.partner_commission_adjustments for delete to authenticated using (company_id=private.current_company_id() and private.is_manager());
grant select,insert,update,delete on public.partner_commission_adjustments to authenticated;
grant all on public.partner_commission_adjustments to service_role;

create or replace function public.protect_partner_commission_integrity()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_privileged boolean:=current_user in ('postgres','service_role');
begin
 new.updated_at:=now();
 if not v_privileged and (old.company_id is distinct from new.company_id or old.placement_id is distinct from new.placement_id or old.partner_user_id is distinct from new.partner_user_id or old.rate is distinct from new.rate or old.amount is distinct from new.amount or old.agreement_id is distinct from new.agreement_id or old.invoice_id is distinct from new.invoice_id or old.eligible_fee_received is distinct from new.eligible_fee_received) then raise exception 'Calculated commission fields cannot be edited manually';end if;
 if old.status='accrued' and new.status not in ('accrued','approved','void') then raise exception 'Accrued commission may only be approved or voided';
 elsif old.status='approved' and new.status not in ('approved','paid','void') then raise exception 'Approved commission may only be paid or voided';
 elsif old.status in ('paid','void') and new.status<>old.status then raise exception 'Paid or void commission status is immutable';end if;
 if old.status in ('approved','paid','void') and (old.company_id is distinct from new.company_id or old.placement_id is distinct from new.placement_id or old.partner_user_id is distinct from new.partner_user_id or old.rate is distinct from new.rate or old.amount is distinct from new.amount or old.agreement_id is distinct from new.agreement_id or old.invoice_id is distinct from new.invoice_id or old.eligible_fee_received is distinct from new.eligible_fee_received) then raise exception 'Approved, paid or void commission amounts are financially locked';end if;
 if new.status='approved' and old.status<>'approved' then new.approved_at:=coalesce(new.approved_at,now());new.approved_by:=coalesce(new.approved_by,auth.uid());end if;
 if new.status='paid' and old.status<>'paid' then if nullif(btrim(new.payment_reference),'') is null then raise exception 'Payment reference is required before marking commission paid';end if;new.paid_at:=coalesce(new.paid_at,now());end if;
 return new;
end $$;
drop trigger if exists trg_partner_commission_integrity on public.partner_commissions;
create trigger trg_partner_commission_integrity before update on public.partner_commissions for each row execute function public.protect_partner_commission_integrity();

create or replace function public.protect_partner_commission_adjustment_integrity()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_privileged boolean:=current_user in ('postgres','service_role');v_base public.partner_commissions%rowtype;
begin
 new.updated_at:=now();
 select * into v_base from public.partner_commissions pc where pc.id=new.base_commission_id;
 if v_base.id is null or v_base.company_id<>new.company_id or v_base.placement_id<>new.placement_id or v_base.partner_user_id is distinct from new.partner_user_id or v_base.agreement_id is distinct from new.agreement_id then raise exception 'Commission adjustment does not match its base commission';end if;
 if not v_privileged and tg_op='UPDATE' and (old.company_id is distinct from new.company_id or old.base_commission_id is distinct from new.base_commission_id or old.placement_id is distinct from new.placement_id or old.partner_user_id is distinct from new.partner_user_id or old.agreement_id is distinct from new.agreement_id or old.source_invoice_id is distinct from new.source_invoice_id or old.eligible_fee_delta is distinct from new.eligible_fee_delta or old.amount is distinct from new.amount or old.reason is distinct from new.reason) then raise exception 'Calculated commission adjustment fields cannot be edited manually';end if;
 if tg_op='UPDATE' then
  if old.status='accrued' and new.status not in ('accrued','approved','void') then raise exception 'Accrued adjustment may only be approved or voided';
  elsif old.status='approved' and new.status not in ('approved','paid','void') then raise exception 'Approved adjustment may only be paid or voided';
  elsif old.status in ('paid','void') and new.status<>old.status then raise exception 'Paid or void adjustment is immutable';end if;
  if old.status in ('approved','paid','void') and (old.eligible_fee_delta is distinct from new.eligible_fee_delta or old.amount is distinct from new.amount or old.agreement_id is distinct from new.agreement_id or old.partner_user_id is distinct from new.partner_user_id or old.placement_id is distinct from new.placement_id) then raise exception 'Approved, paid or void adjustment amounts are financially locked';end if;
 end if;
 if new.status='approved' and (tg_op='INSERT' or old.status<>'approved') then new.approved_at:=coalesce(new.approved_at,now());new.approved_by:=coalesce(new.approved_by,auth.uid());end if;
 if new.status='paid' and (tg_op='INSERT' or old.status<>'paid') then if nullif(btrim(new.payment_reference),'') is null then raise exception 'Payment or offset reference is required before marking adjustment paid';end if;new.paid_at:=coalesce(new.paid_at,now());end if;
 return new;
end $$;
drop trigger if exists trg_partner_commission_adjustment_integrity on public.partner_commission_adjustments;
create trigger trg_partner_commission_adjustment_integrity before insert or update on public.partner_commission_adjustments for each row execute function public.protect_partner_commission_adjustment_integrity();

create or replace function public.sync_partner_commission()
returns trigger language plpgsql security definer set search_path='' as $$
declare a record;v_received numeric;v_target numeric;v_base public.partner_commissions%rowtype;v_settled_fee numeric;v_fee_delta numeric;v_amount_delta numeric;v_open uuid;
begin
 if new.placement_id is null then return new;end if;
 select pa.partner_id,ag.id agreement_id,ag.commission_percent into a
 from public.partner_attributions pa join public.partner_agreements ag on ag.partner_id=pa.partner_id and ag.company_id=pa.company_id and ag.status='accepted'
 where pa.placement_id=new.placement_id and pa.attribution_type='placement_owner' and pa.status='active'
 order by pa.attributed_at desc limit 1;
 if a.partner_id is null then return new;end if;
 select coalesce(sum(i.amount_paid),0) into v_received from public.invoices i where i.placement_id=new.placement_id and i.status<>'void';
 v_target:=round(v_received*a.commission_percent/100,2);
 select * into v_base from public.partner_commissions pc where pc.placement_id=new.placement_id and pc.partner_user_id=a.partner_id for update;
 if v_base.id is null then
  if v_received<=0 then return new;end if;
  insert into public.partner_commissions(company_id,placement_id,partner_user_id,rate,amount,status,agreement_id,invoice_id,eligible_fee_received)
  values(new.company_id,new.placement_id,a.partner_id,a.commission_percent/100,v_target,'accrued',a.agreement_id,new.id,v_received);
  return new;
 end if;
 if v_base.status='accrued' then
  if v_received<=0 then update public.partner_commissions set amount=0,eligible_fee_received=0,invoice_id=new.id,status='void',updated_at=now() where id=v_base.id;
  else update public.partner_commissions set rate=a.commission_percent/100,amount=v_target,eligible_fee_received=v_received,agreement_id=a.agreement_id,invoice_id=new.id,updated_at=now() where id=v_base.id;end if;
  return new;
 end if;
 if v_base.status='void' then return new;end if;
 select coalesce(sum(adj.eligible_fee_delta),0) into v_settled_fee from public.partner_commission_adjustments adj where adj.base_commission_id=v_base.id and adj.status in ('approved','paid');
 v_settled_fee:=v_base.eligible_fee_received+v_settled_fee;
 v_fee_delta:=round(v_received-v_settled_fee,2);v_amount_delta:=round(v_fee_delta*v_base.rate,2);
 select adj.id into v_open from public.partner_commission_adjustments adj where adj.base_commission_id=v_base.id and adj.status='accrued' limit 1 for update;
 if abs(v_fee_delta)<0.005 or abs(v_amount_delta)<0.005 then
  if v_open is not null then update public.partner_commission_adjustments set status='void',reason='No remaining commission adjustment after invoice reconciliation',updated_at=now() where id=v_open;end if;
  return new;
 end if;
 if v_open is null then
  insert into public.partner_commission_adjustments(company_id,base_commission_id,placement_id,partner_user_id,agreement_id,source_invoice_id,eligible_fee_delta,amount,status,reason)
  values(v_base.company_id,v_base.id,v_base.placement_id,v_base.partner_user_id,v_base.agreement_id,new.id,v_fee_delta,v_amount_delta,'accrued',case when v_amount_delta>=0 then 'Additional qualifying client fee received after commission approval' else 'Client fee reduction/refund after commission approval' end);
 else
  update public.partner_commission_adjustments set source_invoice_id=new.id,eligible_fee_delta=v_fee_delta,amount=v_amount_delta,reason=case when v_amount_delta>=0 then 'Additional qualifying client fee received after commission approval' else 'Client fee reduction/refund after commission approval' end,updated_at=now() where id=v_open;
 end if;
 return new;
end $$;
