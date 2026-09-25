
create or replace function public.manager_partner_analytics(p_partner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_company uuid:=private.current_company_id();
  v_profile public.partner_profiles%rowtype;
begin
  if not private.is_manager() then raise exception 'Manager access required'; end if;

  select pp.* into v_profile
  from public.partner_profiles pp
  join public.profiles p on p.id=pp.user_id and p.company_id=pp.company_id and p.role='partner'
  where pp.user_id=p_partner and pp.company_id=v_company;

  if not found then raise exception 'Partner not found'; end if;

  return jsonb_build_object(
    'specialism',v_profile.specialism,
    'targets',jsonb_build_object(
      'client_contacts',v_profile.target_calls,
      'meetings',v_profile.target_meetings,
      'placements',v_profile.target_placements,
      'qualified_opportunities',v_profile.target_qualified_opportunities,
      'tob_acceptances',v_profile.target_tob_acceptances,
      'candidate_recommendations',v_profile.target_candidate_recommendations
    ),
    'actual',jsonb_build_object(
      'client_contacts',(select count(*) from public.partner_communication_events e where e.company_id=v_company and e.partner_id=p_partner and e.occurred_at>=now()-interval '30 days'),
      'calls',(select count(*) from public.partner_communication_events e where e.company_id=v_company and e.partner_id=p_partner and e.event_type='call' and e.occurred_at>=now()-interval '30 days'),
      'emails',(select count(*) from public.partner_communication_events e where e.company_id=v_company and e.partner_id=p_partner and e.event_type='email' and e.occurred_at>=now()-interval '30 days'),
      'meetings',(select count(*) from public.partner_communication_events e where e.company_id=v_company and e.partner_id=p_partner and e.event_type='meeting' and e.occurred_at>=now()-interval '30 days'),
      'qualified_opportunities',(select count(*) from public.partner_opportunities o where o.company_id=v_company and o.owner_partner_id=p_partner and o.stage in ('qualified','meeting','commercial_review','terms_sent','terms_accepted','vacancy_open','won') and o.updated_at>=now()-interval '30 days'),
      'tob_acceptances',(select count(distinct d.client_id) from public.client_terms_documents d join public.partner_assignments a on a.company_id=d.company_id and a.client_id=d.client_id where d.company_id=v_company and a.partner_id=p_partner and d.accepted_at>=now()-interval '30 days'),
      'candidate_recommendations',(select count(*) from public.partner_candidate_pipeline p where p.company_id=v_company and p.partner_id=p_partner and p.stage='recommended' and p.updated_at>=now()-interval '30 days'),
      'submission_packs',(select count(*) from public.partner_submission_packs sp where sp.company_id=v_company and sp.partner_id=p_partner and sp.created_at>=now()-interval '30 days'),
      'interviews',(select count(distinct i.id) from public.interviews i where i.company_id=v_company and i.created_at>=now()-interval '30 days' and exists(select 1 from public.partner_assignments a where a.company_id=v_company and a.partner_id=p_partner and (a.job_id=i.job_id or a.candidate_id=i.candidate_id))),
      'placements',(select count(*) from public.placements pl where pl.company_id=v_company and pl.created_at>=now()-interval '30 days' and exists(select 1 from public.partner_attributions a where a.company_id=v_company and a.partner_id=p_partner and a.placement_id=pl.id and a.status='active')),
      'commission_accrued',(select coalesce(sum(pc.amount),0) from public.partner_commissions pc where pc.company_id=v_company and pc.partner_user_id=p_partner and pc.created_at>=now()-interval '30 days')
    ),
    'pipeline',jsonb_build_object(
      'open_opportunities',(select count(*) from public.partner_opportunities o where o.company_id=v_company and o.owner_partner_id=p_partner and o.stage not in ('won','lost')),
      'weighted_value',(select coalesce(sum(coalesce(o.expected_fee,0)*(o.probability::numeric/100)),0) from public.partner_opportunities o where o.company_id=v_company and o.owner_partner_id=p_partner and o.stage not in ('won','lost')),
      'active_clients',(select count(*) from public.partner_assignments a where a.company_id=v_company and a.partner_id=p_partner and a.client_id is not null and a.completed_at is null),
      'active_vacancies',(select count(*) from public.partner_assignments a where a.company_id=v_company and a.partner_id=p_partner and a.job_id is not null and a.completed_at is null),
      'active_candidates',(select count(*) from public.partner_assignments a where a.company_id=v_company and a.partner_id=p_partner and a.candidate_id is not null and a.completed_at is null)
    )
  );
end
$$;

revoke all on function public.manager_partner_analytics(uuid) from public,anon;
grant execute on function public.manager_partner_analytics(uuid) to authenticated;
