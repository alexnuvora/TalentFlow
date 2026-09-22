alter table public.invoices add column if not exists effective_total numeric;
alter table public.invoices add column if not exists balance_due numeric;
update public.invoices set effective_total=total, balance_due=greatest(total-coalesce(amount_paid,0),0) where effective_total is null or balance_due is null;

create or replace function public.refresh_invoice_balance(p_invoice uuid)
returns void language plpgsql security definer set search_path='public'
as $$ declare v_total numeric; v_paid numeric; v_status text; begin
 select greatest(0,total-coalesce((select sum(case when kind in ('credit','write_off') then amount when kind='debit' then -amount else 0 end) from public.invoice_adjustments where invoice_id=p_invoice),0)),status into v_total,v_status from public.invoices where id=p_invoice;
 if v_status is null then raise exception 'Invoice not found'; end if;
 select coalesce(sum(case when status='succeeded' then amount when status='refunded' then -amount else 0 end),0) into v_paid from public.invoice_payments where invoice_id=p_invoice;
 update public.invoices set effective_total=v_total,amount_paid=least(v_total,greatest(0,v_paid)),balance_due=case when v_status='void' then 0 else greatest(v_total-v_paid,0) end,
 status=case when v_status='void' then 'void' when v_total-v_paid<=0 then 'paid' when v_paid>0 then 'part_paid' when due_date<current_date and v_status in ('sent','overdue','part_paid') then 'overdue' else v_status end,
 paid_at=case when v_status<>'void' and v_total-v_paid<=0 then coalesce(paid_at,now()) else null end,updated_at=now() where id=p_invoice;
end $$;

alter table public.automation_enrollments add column if not exists processing_started_at timestamptz;
create or replace function public.claim_automation_enrollments(p_limit integer default 25)
returns setof uuid language sql security definer set search_path=''
as $$
 with recovered as (
   update public.automation_enrollments set status='queued',processing_started_at=null,updated_at=now()
   where status='processing' and coalesce(processing_started_at,updated_at)<now()-interval '15 minutes'
 ),
 picked as (
   select e.id from public.automation_enrollments e join public.automation_sequences s on s.id=e.sequence_id and s.company_id=e.company_id
   where e.status='queued' and e.next_run_at<=now() and s.active=true order by e.next_run_at for update of e skip locked limit least(greatest(p_limit,1),100)
 ),
 upd as (
   update public.automation_enrollments e set status='processing',processing_started_at=now(),updated_at=now() from picked where e.id=picked.id returning e.id
 )
 select id from upd;
$$;
