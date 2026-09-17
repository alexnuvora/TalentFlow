export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeSlug=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export const plainText=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function jobSchema(job,canonical) {
 if(job.application_mode==='register_interest'||!job.hiring_organization)return {'@context':'https://schema.org','@type':'WebPage',name:job.title,description:plainText(job.description),url:canonical};
 const employment={full_time:'FULL_TIME',part_time:'PART_TIME',contract:'CONTRACTOR',self_employed:'CONTRACTOR',temporary:'TEMPORARY',internship:'INTERN'};
 return {'@context':'https://schema.org','@type':'JobPosting',title:job.title,description:plainText(job.description),datePosted:job.created_at,url:canonical,hiringOrganization:{'@type':'Organization',name:job.hiring_organization},employmentType:employment[job.employment_type],jobLocation:job.location?{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:job.location,addressCountry:'GB'}}:undefined};
}
