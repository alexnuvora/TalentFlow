create or replace function public.sync_subscription_entitlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare allowed boolean;
begin
  select coalesce((p.features->>'automations')::boolean,false) and new.status in ('active','trialing') and (new.status<>'trialing' or new.trial_ends_at>now())
  into allowed from public.saas_plans p where p.code=new.plan_code and p.active=true;
  if coalesce(allowed,false)=false then
    update public.automation_sequences set active=false where company_id=new.company_id and active=true;
  end if;
  return new;
end $$;
revoke execute on function public.sync_subscription_entitlements() from public,anon,authenticated;
drop trigger if exists sync_subscription_entitlements on public.company_subscriptions;
create trigger sync_subscription_entitlements after insert or update of plan_code,status,trial_ends_at on public.company_subscriptions for each row execute function public.sync_subscription_entitlements();
