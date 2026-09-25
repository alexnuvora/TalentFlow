alter table public.clients
  add column if not exists pecr_subscriber_type text not null default 'unknown',
  add column if not exists email_marketing_basis text not null default 'none',
  add column if not exists email_marketing_assessed_at timestamptz,
  add column if not exists email_marketing_evidence text,
  add column if not exists tps_ctps_screened_at timestamptz,
  add column if not exists tps_ctps_clear boolean,
  add column if not exists tps_ctps_evidence text,
  add column if not exists marketing_call_consent_at timestamptz;

do $$ begin
  alter table public.clients add constraint clients_pecr_subscriber_type_check
    check (pecr_subscriber_type in ('unknown','corporate','individual'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clients add constraint clients_email_marketing_basis_check
    check (email_marketing_basis in ('none','legitimate_interests','consent','soft_opt_in','solicited'));
exception when duplicate_object then null; end $$;

create or replace function private.client_email_marketing_allowed(p_client uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select c.email_marketing_assessed_at is not null
   and nullif(btrim(coalesce(c.email_marketing_evidence,'')),'') is not null
   and ((c.pecr_subscriber_type='corporate' and c.email_marketing_basis in ('legitimate_interests','consent','solicited'))
     or (c.pecr_subscriber_type='individual' and c.email_marketing_basis in ('consent','soft_opt_in','solicited')))
 from public.clients c where c.id=p_client and c.company_id=private.current_company_id()),false)
$$;

create or replace function private.client_live_marketing_call_allowed(p_client uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select c.marketing_call_consent_at is not null
   or (c.tps_ctps_clear is true and c.tps_ctps_screened_at is not null
       and c.tps_ctps_screened_at > now()-interval '28 days'
       and nullif(btrim(coalesce(c.tps_ctps_evidence,'')),'') is not null)
 from public.clients c where c.id=p_client and c.company_id=private.current_company_id()),false)
$$;

revoke all on function private.client_email_marketing_allowed(uuid) from public,anon,authenticated;
revoke all on function private.client_live_marketing_call_allowed(uuid) from public,anon,authenticated;

create or replace function public.dispatch_next_ai_dialer_call(p_company_id uuid,p_device_id uuid)
returns table(request_id uuid,phone_number text,item_id uuid,campaign_id uuid)
language plpgsql security definer set search_path='public' as $$
declare v_campaign ai_dialer_campaigns%rowtype;v_item ai_dialer_items%rowtype;v_request uuid;v_now timestamptz:=now();v_used int;
begin
 perform pg_advisory_xact_lock(hashtext(p_device_id::text));
 if exists(select 1 from call_gateway_requests where company_id=p_company_id and device_id=p_device_id and status in ('approved','claimed') and expires_at>v_now) then return; end if;
 if exists(select 1 from ai_dialer_items i join ai_dialer_campaigns c on c.id=i.campaign_id where c.company_id=p_company_id and c.device_id=p_device_id and c.status='running' and i.status='dialing') then return; end if;
 select * into v_campaign from ai_dialer_campaigns where company_id=p_company_id and device_id=p_device_id and status='running' and (next_call_after is null or next_call_after<=v_now) order by created_at for update skip locked limit 1;
 if not found then return; end if;
 select count(*) into v_used from ai_dialer_items where ai_dialer_items.campaign_id=v_campaign.id and status in ('dialing','completed','failed');
 if v_used>=v_campaign.max_calls then update ai_dialer_campaigns set status='completed',completed_at=v_now where id=v_campaign.id;return;end if;
 select * into v_item from ai_dialer_items where ai_dialer_items.campaign_id=v_campaign.id and status='queued' and research_status in ('not_needed','ready') order by position for update skip locked limit 1;
 if not found then
  if not exists(select 1 from ai_dialer_items where ai_dialer_items.campaign_id=v_campaign.id and status in ('queued','dialing')) then update ai_dialer_campaigns set status='completed',completed_at=v_now where id=v_campaign.id;end if;
  return;
 end if;
 if not exists(select 1 from public.clients c where c.id=v_item.client_id and c.company_id=p_company_id
   and coalesce(c.call_status,'not_contacted') not in ('do_not_call','suppressed','wrong_number','not_interested')
   and (c.next_call_at is null or c.next_call_at<=v_now)
   and (c.marketing_call_consent_at is not null or (c.tps_ctps_clear is true and c.tps_ctps_screened_at is not null
      and c.tps_ctps_screened_at>v_now-interval '28 days' and nullif(btrim(coalesce(c.tps_ctps_evidence,'')),'') is not null)))
 then update public.ai_dialer_items set status='blocked',last_error='Live marketing call requires current TPS/CTPS screening evidence or specific call consent',completed_at=v_now where id=v_item.id;return;end if;
 if exists(select 1 from b2b_call_suppressions s where s.company_id=p_company_id and (s.client_id=v_item.client_id or regexp_replace(coalesce(s.phone_normalized,''),'[^0-9]','','g')=regexp_replace(v_item.phone_number,'[^0-9]','','g')))
 then update ai_dialer_items set status='blocked',last_error='suppressed before dispatch',completed_at=v_now where id=v_item.id;return;end if;
 insert into call_gateway_requests(company_id,device_id,phone_number,status,approved_at) values(p_company_id,p_device_id,v_item.phone_number,'approved',v_now) returning id into v_request;
 update ai_dialer_items set status='dialing',call_request_id=v_request,attempts=attempts+1 where id=v_item.id;
 update clients set call_attempts=coalesce(call_attempts,0)+1,last_contacted_at=v_now where id=v_item.client_id and company_id=p_company_id;
 return query select v_request,v_item.phone_number,v_item.id,v_campaign.id;
end $$;

create or replace function public.claim_gateway_call(p_company uuid,p_device uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.call_gateway_requests%rowtype;
begin
 perform pg_advisory_xact_lock(hashtext(p_device::text));
 select * into r from public.call_gateway_requests where company_id=p_company and device_id=p_device and status='approved' and expires_at>now() order by created_at for update skip locked limit 1;
 if not found then return null;end if;
 if exists(select 1 from public.ai_dialer_items i join public.ai_dialer_campaigns c on c.id=i.campaign_id join public.clients cl on cl.id=i.client_id and cl.company_id=i.company_id
   where i.call_request_id=r.id and (c.status<>'running' or coalesce(cl.call_status,'') in ('do_not_call','suppressed','wrong_number','not_interested') or cl.next_call_at>now()
     or not (cl.marketing_call_consent_at is not null or (cl.tps_ctps_clear is true and cl.tps_ctps_screened_at is not null and cl.tps_ctps_screened_at>now()-interval '28 days' and nullif(btrim(coalesce(cl.tps_ctps_evidence,'')),'') is not null))))
 or exists(select 1 from public.b2b_call_suppressions s where s.company_id=p_company and regexp_replace(coalesce(s.phone_normalized,''),'[^0-9]','','g')=regexp_replace(r.phone_number,'[^0-9]','','g'))
 then
   update public.call_gateway_requests set status='failed',error='Eligibility or marketing compliance changed before device claim',completed_at=now() where id=r.id;
   update public.ai_dialer_items set status='blocked',last_error='Eligibility or marketing compliance changed before device claim',completed_at=now() where call_request_id=r.id;
   return null;
 end if;
 update public.call_gateway_requests set status='claimed',claimed_at=now() where id=r.id;
 return jsonb_build_object('id',r.id,'action','call','phone_number',r.phone_number);
end $$;

revoke all on table public.partner_integration_requests from anon,authenticated;
