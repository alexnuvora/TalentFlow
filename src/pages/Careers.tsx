import {useEffect,useState} from 'react';import {Link,useParams,useSearchParams} from 'react-router-dom';import {BriefcaseBusiness,MapPin,ArrowRight,CheckCircle2,CalendarDays,Clock3,Banknote,ShieldCheck,FileText,Check,LockKeyhole} from 'lucide-react';import {getPublicJob,getPublicJobs,submitApplication} from '../lib/api';import {Card,Button,SkeletonCards} from '../components/Ui';import {trackApplicationStart,trackJobView} from '../lib/tracking';import {setSeo} from '../lib/seo';import VorlenBrand from '../components/VorlenBrand';
const brand=<VorlenBrand to="/careers"/>;const clientName=(j:any)=>{const c=Array.isArray(j?.clients)?j.clients[0]:j?.clients;return c?.company_name||c?.name||''};
export function Careers(){const[jobs,setJobs]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');useEffect(()=>{setSeo({title:'Open recruitment opportunities | Vorlen Careers',description:'Browse current opportunities published through Vorlen and apply online.',path:'/careers'});getPublicJobs().then(({data,error})=>{setJobs(data||[]);setError(error?.message||'');setLoading(false)})},[]);return <div className="customer-public"><div className="public"><header>{brand}<Link className="text-link" to="/">About Vorlen</Link></header><main><section className="hero"><span className="public-pill">OPEN OPPORTUNITIES</span><h1>Find the role that moves you forward.</h1><p>Explore current opportunities, understand the role before you apply and stay connected to the recruitment team handling it.</p></section><div className="public-trust"><span>Clear application process</span><span>Secure CV submission</span><span>Application updates</span></div><section className="public-jobs" aria-label="Open opportunities">{loading?<SkeletonCards count={3}/>:error?<Card className="empty"><h3>Opportunities could not be loaded</h3><p>Please try again shortly.</p></Card>:jobs.length?jobs.map(j=><Card key={j.id}><div className="card-head"><div><h2>{j.title}</h2><p>{j.application_mode==='register_interest'?'Talent pool opportunity':'Recruitment opportunity'}</p></div><span className="badge green">{j.employment_type?.replace('_',' ')}</span></div><p><MapPin size={14}/> {j.location||'Location flexible'}</p>{j.pay_text&&<p><strong>{j.pay_text}</strong></p>}<Link className="text-link" to={`/careers/${encodeURIComponent(j.slug)}`}>View opportunity <ArrowRight size={14}/></Link></Card>):<Card className="empty"><BriefcaseBusiness size={28}/><h3>No opportunities are open right now</h3><p>Check back soon for newly published roles.</p></Card>}</section></main></div></div>}
export function JobPage(){const{slug}=useParams(),[search]=useSearchParams(),[partnerRef]=useState(()=>search.get('partner_ref')||''),[job,setJob]=useState<any>(null),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[step,setStep]=useState(1),[error,setError]=useState(''),[result,setResult]=useState<any>(null),[submitting,setSubmitting]=useState(false),[form,setForm]=useState<any>({first_name:'',last_name:'',email:'',phone:'',location:'',postal_address:'',age_band:'',date_of_birth:'',linkedin_url:'',cover_note:'',consent:false,marketing_opt_in:false,terms_agreed:false,answers:{}}),[file,setFile]=useState<File|null>(null);useEffect(()=>{if(partnerRef&&typeof window!=='undefined'){const u=new URL(window.location.href);if(u.searchParams.has('partner_ref')){u.searchParams.delete('partner_ref');window.history.replaceState(window.history.state,'',u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():'')+u.hash)}}},[partnerRef]);useEffect(()=>{let active=true;setLoading(true);setLoadError('');getPublicJob(decodeURIComponent(slug||'')).then(({data,error})=>{if(!active)return;setJob(data||null);setLoadError(error?.message||'');setLoading(false);if(data){const schema:any=data.application_mode==='register_interest'?{'@context':'https://schema.org','@type':'WebPage',name:data.title,description:data.description||data.title}:{'@context':'https://schema.org','@type':'JobPosting',title:data.title,description:data.description||data.title,datePosted:data.created_at,employmentType:data.employment_type,jobLocation:data.location?{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:data.location}}:undefined};setSeo({title:`${data.title} | Vorlen Careers`,description:String(data.description||`Apply for ${data.title}${data.location?` in ${data.location}`:''}.`).replace(/\s+/g,' ').slice(0,155),path:`/careers/${slug}`,jsonLd:schema});trackJobView(data.id,{campaign_slug:search.get('campaign')||undefined,link_slug:(search.get('ref')||search.get('link'))||undefined,utm_source:search.get('utm_source')||undefined,utm_medium:search.get('utm_medium')||undefined,utm_campaign:search.get('utm_campaign')||undefined,utm_content:search.get('utm_content')||undefined})}});return()=>{active=false}},[slug]);function update(k:string,v:any){setForm((f:any)=>({...f,[k]:v}))}function answer(id:string,v:string){setForm((f:any)=>({...f,answers:{...f.answers,[id]:v}}))}function next(){if(step===1&&(!form.first_name||!form.last_name||!form.email||!form.postal_address||!form.age_band||(form.age_band==='under_22'&&!form.date_of_birth))){setError('Enter your name, email, postal address and age record to continue.');return}if(step===2&&!file){setError('Upload your CV to continue.');return}setError('');if(step===1&&job)trackApplicationStart(job.id,{campaign_slug:search.get('campaign')||undefined,link_slug:(search.get('ref')||search.get('link'))||undefined});setStep(s=>Math.min(4,s+1))}async function submit(e:any){e.preventDefault();if(submitting)return;setSubmitting(true);setError('');const questions=job.application_questions||[],missing=questions.find((q:any)=>q.required&&!String(form.answers?.[q.id]||'').trim());if(missing){setStep(3);setError(`Please answer: ${missing.label||missing.question||'required question'}`);setSubmitting(false);return}if(!form.consent||!form.terms_agreed){setError('Please confirm the privacy notice and work-seeker terms.');setSubmitting(false);return}const fd=new FormData();Object.entries(form).forEach(([k,v])=>{if(k==='answers')fd.append(k,JSON.stringify(v));else fd.append(k,String(v))});fd.append('full_name',`${form.first_name} ${form.last_name}`.trim());fd.append('job_id',job.id);fd.append('campaign_id',search.get('campaign_id')||'');fd.append('campaign_slug',search.get('campaign')||'');fd.append('referral_slug',search.get('ref')||search.get('link')||'');fd.append('partner_ref',partnerRef);['utm_source','utm_medium','utm_campaign','utm_content'].forEach(k=>fd.append(k,search.get(k)||''));if(file){if(file.size>5*1024*1024){setError('CV must be 5MB or smaller.');setSubmitting(false);return}fd.append('resume_file',file)}const{data,error}=await submitApplication(fd);setSubmitting(false);if(error)setError(error.message);else setResult(data)}if(loading)return <div className="customer-public"><div className="public"><SkeletonCards count={2}/></div></div>;if(loadError)return <div className="customer-public"><div className="public"><Card className="empty"><h2>We couldn't load this opportunity</h2><p>Please return to the opportunities page and try again.</p><Link to="/careers">Browse open opportunities</Link></Card></div></div>;if(!job)return <div className="customer-public"><div className="public"><Card className="empty"><h2>Opportunity not found</h2><Link to="/careers">Browse open opportunities</Link></Card></div></div>;const questions=job.application_questions||[];const interest=job.application_mode==='register_interest';
const startLabel=job.start_date?new Date(job.start_date+'T00:00:00').toLocaleDateString('en-GB'):(job.start_date_text||'To be confirmed');
const payLabel=job.minimum_remuneration_text||job.pay_text||job.commission_text||'Package details available from Vorlen';
const progressLabels=['Your details','CV','Questions','Review'];
return <div className="customer-public job-page-v2">
  <div className="public job-public-wrap">
    <header className="public-job-nav">
      {brand}
      <Link className="job-back-link" to="/careers">All opportunities <ArrowRight size={14}/></Link>
    </header>

    <section className="job-hero-v2">
      <div className="job-hero-copy">
        <div className="job-hero-kicker">
          <span className="public-pill">{interest?'REGISTER INTEREST':'OPEN ROLE'}</span>
          <span className="job-reference">Vorlen Careers</span>
        </div>
        <h1>{job.title}</h1>
        <p className="job-hero-summary">A confidential recruitment opportunity managed by Vorlen.</p>
        <div className="job-meta-chips" aria-label="Role summary">
          <span><MapPin size={15}/>{job.location||'Location flexible'}</span>
          <span><BriefcaseBusiness size={15}/>{job.employment_type?.replaceAll('_',' ')||'Permanent'}</span>
          <span><CalendarDays size={15}/>{startLabel}</span>
          <span><Banknote size={15}/>{payLabel}</span>
        </div>
        <div className="job-agency-note">
          <ShieldCheck size={16}/>
          <span><strong>Managed by Vorlen</strong> · Permanent recruitment · Confidential client</span>
        </div>
      </div>
    </section>

    <main className="job-layout-v2">
      <article className="job-content-v2">
        <section className="job-section job-about-section">
          <div className="job-section-heading">
            <span>01</span>
            <div><p>THE OPPORTUNITY</p><h2>About the role</h2></div>
          </div>
          <div className="job-description">{job.description}</div>
        </section>

        {!interest&&<section className="job-section">
          <div className="job-section-heading">
            <span>02</span>
            <div><p>ROLE DETAILS</p><h2>Vacancy particulars</h2></div>
          </div>
          <div className="job-detail-grid">
            <div className="job-detail-card"><CalendarDays size={18}/><small>Start</small><strong>{startLabel}</strong></div>
            <div className="job-detail-card"><Clock3 size={18}/><small>Duration</small><strong>{job.duration_text||'To be confirmed'}</strong></div>
            <div className="job-detail-card wide"><Clock3 size={18}/><small>Working pattern</small><strong>{job.work_days_hours||'To be confirmed'}</strong></div>
            <div className="job-detail-card wide"><FileText size={18}/><small>Duties</small><strong>{job.duties||'To be confirmed'}</strong></div>
            <div className="job-detail-card wide"><ShieldCheck size={18}/><small>Health & safety</small><strong>{job.health_safety_risks||'To be confirmed'}</strong>{job.health_safety_measures&&<p>Controls: {job.health_safety_measures}</p>}</div>
            <div className="job-detail-card wide"><CheckCircle2 size={18}/><small>Qualifications & authorisations</small><strong>{job.required_qualifications||'To be confirmed'}</strong></div>
            <div className="job-detail-card"><Banknote size={18}/><small>Expenses</small><strong>{job.expenses_text||'To be confirmed'}</strong></div>
            <div className="job-detail-card"><Banknote size={18}/><small>Pay interval</small><strong>{job.pay_interval||'To be confirmed'}</strong></div>
            <div className="job-detail-card wide highlight"><Banknote size={18}/><small>Minimum remuneration & benefits</small><strong>{payLabel}</strong></div>
            <div className="job-detail-card"><FileText size={18}/><small>Notice</small><strong>{job.notice_period||'To be confirmed'}</strong></div>
          </div>
        </section>}

        {job.requirements?.length>0&&<section className="job-section">
          <div className="job-section-heading">
            <span>{interest?'02':'03'}</span>
            <div><p>CANDIDATE PROFILE</p><h2>What we're looking for</h2></div>
          </div>
          <ul className="job-requirements">{job.requirements.map((x:string)=><li key={x}><Check size={16}/><span>{x}</span></li>)}</ul>
        </section>}

        <section className="job-section job-process-note">
          <div><LockKeyhole size={20}/></div>
          <div><strong>Your application stays with Vorlen.</strong><p>We manage the recruitment process and only share candidate information with the client as part of the agreed recruitment process.</p></div>
        </section>
      </article>

      <aside className="job-apply-column">
        <Card className="job-apply-card">
          {result?<div className="success job-success"><CheckCircle2 size={34}/><h2>{interest?'Interest registered':'Application received'}</h2><p>{interest?'Your details are in the talent pool for this opportunity.':'The Vorlen recruitment team has received your application.'}</p>{result.portal_url&&<a className="btn" href={result.portal_url}>Track your application</a>}</div>:
          <form className="conversion-form job-application-form" onSubmit={submit}>
            <div className="job-apply-intro">
              <span className="job-apply-eyebrow">{interest?'JOIN THE TALENT POOL':'APPLY WITH VORLEN'}</span>
              <h2>{interest?'Register your interest':'Apply for this role'}</h2>
              <p>{interest?'Share your details with our recruitment team.':'It takes a few minutes. You can review everything before submitting.'}</p>
            </div>
            <div className="application-progress application-progress-v2">{progressLabels.map((x,i)=><div className={step>=i+1?'active':''} key={x}><span>{step>i+1?<Check size={12}/>:i+1}</span><small>{x}</small></div>)}</div>
            {interest&&job.opportunity_notice&&<div className="alert">{job.opportunity_notice}</div>}

            {step===1&&<div className="form-step">
              <div className="job-step-heading"><span>Step 1 of 4</span><h3>Your details</h3></div>
              <label>First name<input required autoComplete="given-name" value={form.first_name} onChange={e=>update('first_name',e.target.value)}/></label>
              <label>Last name<input required autoComplete="family-name" value={form.last_name} onChange={e=>update('last_name',e.target.value)}/></label>
              <label>Email<input required type="email" autoComplete="email" value={form.email} onChange={e=>update('email',e.target.value)}/></label>
              <label>Phone<input autoComplete="tel" value={form.phone} onChange={e=>update('phone',e.target.value)}/></label>
              <label>Location<input autoComplete="address-level2" value={form.location} onChange={e=>update('location',e.target.value)}/></label>
              <label className="full">Postal address<textarea required rows={2} autoComplete="street-address" value={form.postal_address} onChange={e=>update('postal_address',e.target.value)}/></label>
              <label>Age record<select required value={form.age_band} onChange={e=>update('age_band',e.target.value)}><option value="">Select…</option><option value="22_or_over">22 or over</option><option value="under_22">Under 22</option></select></label>
              {form.age_band==='under_22'&&<label>Date of birth<input required type="date" value={form.date_of_birth} onChange={e=>update('date_of_birth',e.target.value)}/></label>}
            </div>}

            {step===2&&<div className="form-step">
              <div className="job-step-heading"><span>Step 2 of 4</span><h3>Your experience</h3></div>
              <label>CV<input required type="file" accept=".pdf,.doc,.docx" onChange={e=>setFile(e.target.files?.[0]||null)}/><span className="muted">PDF or Word document, up to 5MB.</span></label>
              <label>LinkedIn profile<input type="url" value={form.linkedin_url} onChange={e=>update('linkedin_url',e.target.value)}/></label>
              <label>Note to recruiter<textarea rows={5} value={form.cover_note} onChange={e=>update('cover_note',e.target.value)} placeholder="Optional — tell us anything useful about your experience or availability."/></label>
            </div>}

            {step===3&&<div className="form-step">
              <div className="job-step-heading"><span>Step 3 of 4</span><h3>Role questions</h3></div>
              {questions.length?questions.map((q:any)=><label key={q.id}>{q.label||q.question}{q.type==='select'?<select required={q.required} value={form.answers[q.id]||''} onChange={e=>answer(q.id,e.target.value)}><option value="">Select…</option>{q.options?.map((o:string)=><option key={o}>{o}</option>)}</select>:<input required={q.required} value={form.answers[q.id]||''} onChange={e=>answer(q.id,e.target.value)}/>}</label>):<div className="screening-placeholder">No additional questions for this opportunity.</div>}
            </div>}

            {step===4&&<div className="form-step">
              <div className="job-step-heading"><span>Step 4 of 4</span><h3>Review and submit</h3></div>
              <div className="review-box"><strong>{form.first_name} {form.last_name}</strong><span>{form.email}</span><span>{file?.name}</span></div>
              <label className="check"><input type="checkbox" checked={form.consent} onChange={e=>update('consent',e.target.checked)}/>I have read the <Link to="/privacy" target="_blank" rel="noreferrer">candidate privacy notice</Link>, including the section explaining AI-assisted screening, human review and my right to challenge an automated outcome.</label>
              <label className="check"><input type="checkbox" checked={form.terms_agreed} onChange={e=>update('terms_agreed',e.target.checked)}/>I agree to the <Link to="/candidate-terms" target="_blank" rel="noreferrer">Vorlen work-seeker terms</Link> for permanent recruitment services.</label>
              <label className="check"><input type="checkbox" checked={form.marketing_opt_in} onChange={e=>update('marketing_opt_in',e.target.checked)}/>Keep me informed about other relevant opportunities.</label>
            </div>}

            {error&&<div className="alert error" role="alert">{error}</div>}
            <div className="form-actions job-form-actions">
              {step>1&&<Button type="button" variant="ghost" onClick={()=>{setError('');setStep(s=>s-1)}}>Back</Button>}
              {step<4?<Button type="button" onClick={next}>Continue <ArrowRight size={15}/></Button>:<Button type="submit" disabled={submitting}>{submitting?'Submitting…':(interest?'Register interest':'Submit application')}</Button>}
            </div>
            <div className="job-form-trust"><LockKeyhole size={13}/><span>Secure application · handled by Vorlen</span></div>
          </form>}
        </Card>
      </aside>
    </main>
  </div>
</div>}