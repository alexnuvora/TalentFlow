create or replace function private.sync_placement_invoice_state()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.placement_id is null then return new; end if;
 update public.placements p
 set invoice_number=new.number,
     invoice_status=new.status,
     invoiced_at=coalesce(p.invoiced_at,new.sent_at,new.issue_date::timestamptz,new.created_at),
     due_at=coalesce(new.due_date::timestamptz,p.due_at),
     paid_at=case when new.status='paid' then coalesce(new.paid_at,p.paid_at,now()) else p.paid_at end,
     updated_at=now()
 where p.id=new.placement_id and p.company_id=new.company_id
   and (p.invoice_status<>'paid' or new.status='paid');
 return new;
end$$;
revoke all on function private.sync_placement_invoice_state() from public,anon,authenticated;
drop trigger if exists trg_sync_placement_invoice_state on public.invoices;
create trigger trg_sync_placement_invoice_state after insert or update of status,amount_paid,balance_due,sent_at,paid_at,voided_at,due_date on public.invoices for each row execute function private.sync_placement_invoice_state();