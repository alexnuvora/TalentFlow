export type PartnerSourcingState='research_opportunity'|'internal_sourcing_approved'|'published';

export const partnerSourcingState=(job:any):PartnerSourcingState=>{
 const status=String(job?.status||'');
 if(status==='paused'||status==='closed')return 'research_opportunity';
 if(status==='published')return 'published';
 const explicit=String(job?.partner_sourcing_state||'');
 if(explicit==='internal_sourcing_approved')return 'internal_sourcing_approved';
 return 'research_opportunity';
};

export const partnerSourcingMeta=(job:any)=>{
 const state=partnerSourcingState(job);
 if(state==='published')return{
  state,
  label:'Published Vacancy — Source Candidates/Public Applications',
  shortLabel:'Published Vacancy',
  eyebrow:'PUBLISHED VACANCY',
  detail:'Source candidates · public applications open',
  tone:'green' as const,
  canSource:true,
  publicApplications:true
 };
 if(state==='internal_sourcing_approved')return{
  state,
  label:'Internal Sourcing Approved — Source Candidates',
  shortLabel:'Internal Sourcing Approved',
  eyebrow:'INTERNAL SOURCING APPROVED',
  detail:'Source candidates · not publicly advertised',
  tone:'green' as const,
  canSource:true,
  publicApplications:false
 };
 return{
  state:'research_opportunity' as const,
  label:'Research Opportunity — Do Not Source',
  shortLabel:'Research Opportunity — Do Not Source',
  eyebrow:'RESEARCH OPPORTUNITY — DO NOT SOURCE',
  detail:'Do not source candidates until Vorlen management explicitly approves internal sourcing',
  tone:'amber' as const,
  canSource:false,
  publicApplications:false
 };
};

export const canSourceForJob=(job:any)=>partnerSourcingMeta(job).canSource;
