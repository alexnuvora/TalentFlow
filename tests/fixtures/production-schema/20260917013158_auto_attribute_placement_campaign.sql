create or replace function public.set_placement_campaign_from_application()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.campaign_id is null and new.candidate_id is not null and new.job_id is not null then
    select ae.campaign_id
      into new.campaign_id
    from public.applications a
    join public.application_events ae on ae.application_id = a.id
    join public.campaigns c on c.id = ae.campaign_id
    where a.candidate_id = new.candidate_id
      and a.job_id = new.job_id
      and a.company_id = new.company_id
      and ae.event_type = 'application_submitted'
      and ae.campaign_id is not null
      and c.company_id = new.company_id
    order by ae.created_at desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists placements_auto_campaign_attribution on public.placements;
create trigger placements_auto_campaign_attribution
before insert or update of candidate_id, job_id, campaign_id on public.placements
for each row execute function public.set_placement_campaign_from_application();
