drop policy if exists "workspace members read commissions" on public.partner_commissions;
create policy "commission read own or managers" on public.partner_commissions for select to authenticated using(company_id=(select public.current_company_id()) and(partner_user_id=(select auth.uid()) or(select public.is_manager())));
create or replace function public.sync_partner_commission() returns trigger language plpgsql security definer set search_path=public as $$declare a record;received numeric;begin
 if new.placement_id is null then return new; end if;
 select pa.partner_id,ag.id agreement_id,ag.commission_percent into a from public.partner_attributions pa join public.partner_agreements ag on ag.partner_id=pa.partner_id and ag.company_id=pa.company_id and ag.status='accepted' where pa.placement_id=new.placement_id and pa.attribution_type='placement_owner' and pa.status='active' order by pa.attributed_at desc limit 1;
 if a.partner_id is null then return new; end if;
 select coalesce(sum(amount_paid),0) into received from public.invoices where placement_id=new.placement_id and status<>'void';
 if received<=0 then return new; end if;
 insert into public.partner_commissions(company_id,placement_id,partner_user_id,rate,amount,status,agreement_id,invoice_id,eligible_fee_received)
 values(new.company_id,new.placement_id,a.partner_id,a.commission_percent/100,round(received*a.commission_percent/100,2),'accrued',a.agreement_id,new.id,received)
 on conflict(placement_id,partner_user_id) do update set rate=excluded.rate,amount=excluded.amount,eligible_fee_received=excluded.eligible_fee_received,agreement_id=excluded.agreement_id,invoice_id=excluded.invoice_id,updated_at=now();
 return new;end$$;
revoke all on function public.sync_partner_commission() from public,anon,authenticated;
drop trigger if exists trg_sync_partner_commission on public.invoices;create trigger trg_sync_partner_commission after insert or update of amount_paid,status,paid_at on public.invoices for each row execute function public.sync_partner_commission();
