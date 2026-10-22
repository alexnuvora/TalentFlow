import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ArrowUpRight,BriefcaseBusiness,MapPin,Search} from 'lucide-react';
import {publicSupabase} from '../lib/supabase';
import {setSeo} from '../lib/seo';
import VorlenBrand from '../components/VorlenBrand';

type Opportunity={id:string;slug:string;title:string;location:string|null;employment_type:string;description:string|null;commission_text:string|null;minimum_remuneration_text:string|null;salary_min:number|null;salary_max:number|null;pay_interval:string|null;application_mode?:string};

export function CareersHeader(){return <header className="careers-nav careers-nav-editorial"><VorlenBrand to="/careers"/><nav><Link to="/careers">Opportunities</Link><Link to="/candidates">Candidate guide</Link><Link to="/candidate-terms">Terms</Link><Link to="/" className="workspace-link">Vorlen <ArrowUpRight size={14}/></Link></nav></header>}

export function CareersFooter(){return <footer className="careers-footer careers-footer-editorial"><div><VorlenBrand/><p>Find work that suits you.</p></div><nav><Link to="/candidates">For candidates</Link><Link to="/privacy">Privacy</Link><Link to="/candidate-terms">Candidate terms</Link><Link to="/accessibility">Accessibility</Link></nav></footer>}

export default function CareersHome(){
  const [jobs,setJobs]=useState<Opportunity[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[query,setQuery]=useState(''),[place,setPlace]=useState(''),[type,setType]=useState('');
  async function loadJobs(){setLoading(true);setError(false);const r=await publicSupabase.from('jobs').select('id,slug,title,location,employment_type,description,commission_text,minimum_remuneration_text,salary_min,salary_max,pay_interval,application_mode').eq('status','published').order('created_at',{ascending:false});setJobs(r.data||[]);setError(!!r.error);setLoading(false)}
  useEffect(()=>{setSeo({title:'Recruitment opportunities | Vorlen Careers',description:'Explore current vacancies and clearly labelled candidate-pool opportunities managed through Vorlen.',path:'/careers'});void loadJobs()},[]);
  const types=[...new Set(jobs.map(j=>j.employment_type).filter(Boolean))].sort();
  const filtered=jobs.filter(j=>(j.title+' '+(j.description||'')).toLowerCase().includes(query.toLowerCase())&&String(j.location||'').toLowerCase().includes(place.toLowerCase())&&(!type||j.employment_type===type));
  const pay=(j:Opportunity)=>j.minimum_remuneration_text||((j.salary_min||j.salary_max)?([j.salary_min!=null?'£'+Number(j.salary_min).toLocaleString('en-GB'):null,j.salary_max!=null?'£'+Number(j.salary_max).toLocaleString('en-GB'):null].filter(Boolean).join(' – ')+(j.pay_interval?' / '+j.pay_interval:'')):j.commission_text||'Pay details in the role brief');
  const excerpt=(s:string|null)=>{const clean=String(s||'').replace(/\s+/g,' ').trim();return clean.length>185?clean.slice(0,182)+'…':clean};

  return <div className="careers-site careers-editorial">
    <a className="skip-link" href="#opportunities">Skip to opportunities</a>
    <CareersHeader/>
    <main>
      <section className="ce-hero">
        <div className="ce-hero-mark"><span>CAREERS / VORLEN</span><span>UK</span></div>
        <div className="ce-hero-copy">
          <span className="careers-kicker"><span/> CURRENT OPPORTUNITIES</span>
          <h1>Find your next role.<br/><em>See what’s out there.</em></h1>
          <p>Browse our current vacancies, read about the jobs and apply online when something feels right.</p><a className="ce-hero-jump" href="#opportunities">Browse {loading?'opportunities':jobs.length+' current opportunities'} <ArrowRight size={17}/></a>
        </div>
        <div className="ce-hero-side">
          <span>BEFORE YOU APPLY</span>
          <ol><li>Read the role and terms.</li><li>Submit relevant evidence.</li><li>A recruiter reviews your application.</li></ol>
          <p>Register-interest opportunities are labelled before submission.</p>
        </div>
      </section>

      <section id="opportunities" className="ce-opportunities">
        <div className="ce-opportunities-head">
          <div><span className="careers-kicker">FIND A ROLE</span><h2>Opportunities</h2></div>
          <p>{loading?'Loading current vacancies…':error?'Unable to load vacancies — please try again shortly':String(filtered.length)+' matching '+(filtered.length===1?'role':'roles')}</p>
        </div>

        <form className="ce-filter" onSubmit={e=>e.preventDefault()} role="search">
          <label><span>Role or keyword</span><div><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Job title or skill"/></div></label>
          <label><span>Location</span><div><MapPin size={16}/><input value={place} onChange={e=>setPlace(e.target.value)} placeholder="Town, city or remote"/></div></label>
          <label><span>Type</span><select value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option>{types.map(t=><option key={t}>{t}</option>)}</select></label>
        </form>

        <div className="ce-list" aria-live="polite">
          {loading&&<div role="status" aria-label="Loading opportunities">{[1,2,3].map(n=><article key={n} className="ce-job" style={{opacity:.5}}><span className="ce-job-index">—</span><div className="ce-job-main"><h3>Loading vacancy…</h3><p>Retrieving the latest published opportunities</p></div></article>)}</div>}
          {error&&<div className="careers-state"><h3>We couldn't load opportunities.</h3><p>Please try again. Your search has been preserved.</p><button className="btn" type="button" onClick={()=>void loadJobs()}>Retry loading vacancies</button></div>}
          {!loading&&!error&&filtered.map((j,i)=><article className="ce-job" key={j.id}>
            <span className="ce-job-index">{String(i+1).padStart(2,'0')}</span>
            <div className="ce-job-main">
              <div className="ce-job-meta"><span>{j.application_mode==='register_interest'?'REGISTER INTEREST':j.employment_type?.replaceAll('_',' ')}</span><span>{j.location||'Location not provided'}</span></div>
              <h3><Link to={'/careers/'+encodeURIComponent(j.slug)}>{j.title}</Link></h3>
              <p>{excerpt(j.description)}</p>
            </div>
            <div className="ce-job-terms"><span>PAY / TERMS</span><p>{excerpt(pay(j))}</p></div>
            <Link className="ce-job-link" to={'/careers/'+encodeURIComponent(j.slug)} aria-label={'View '+j.title}><ArrowUpRight size={20}/></Link>
          </article>)}
          {!loading&&!error&&filtered.length===0&&<div className="careers-state"><BriefcaseBusiness size={28}/><h3>No matching opportunities.</h3><p>Try a broader keyword, location or employment type.</p></div>}
        </div>
      </section>

      <section className="ce-close">
        <div><span>NOT READY TO APPLY?</span><h2>Want to know more about applying through Vorlen?</h2></div>
        <Link to="/candidates">Candidate guide <ArrowRight size={15}/></Link>
      </section>
    </main>
    <CareersFooter/>
  </div>
}
