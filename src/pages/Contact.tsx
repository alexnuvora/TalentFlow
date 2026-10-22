import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,BriefcaseBusiness,Network,Users} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import {setSeo} from '../lib/seo';
import {supabase} from '../lib/supabase';

const reasons=[
  {value:'employer',label:'I need to hire',icon:BriefcaseBusiness},
  {value:'candidate',label:'I have a candidate or application question',icon:Users},
  {value:'partner',label:'I want to discuss the partner network',icon:Network}
];

export default function Contact(){
  const[name,setName]=useState(''),[email,setEmail]=useState(''),[company,setCompany]=useState(''),[reason,setReason]=useState('employer'),[message,setMessage]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reference,setReference]=useState(''),[website,setWebsite]=useState(''),[roleTitle,setRoleTitle]=useState('');
  useEffect(()=>setSeo({title:'Contact Vorlen | UK Permanent Recruitment',description:'Talk to Vorlen about a permanent vacancy, candidate query or recruitment partnership.',path:'/contact'}),[]);
  async function submit(e:any){
    e.preventDefault();setError('');setBusy(true);
    try{const {data,error:e}=await supabase.functions.invoke('public-enquiry',{body:{name,email,company,reason,message,website,role_title:reason==='employer'?roleTitle:'',source_page:document.referrer&&new URL(document.referrer).origin===window.location.origin?new URL(document.referrer).pathname:window.location.pathname,utm_source:new URLSearchParams(window.location.search).get('utm_source')||'',utm_campaign:new URLSearchParams(window.location.search).get('utm_campaign')||''}});if(e||!data?.ok)throw new Error(data?.error||e?.message||'Unable to submit enquiry.');setReference(data.reference||'');setSent(true)}catch(e){setError(e instanceof Error?e.message:'Unable to submit enquiry.');}finally{setBusy(false)}
  }

  return <div className="vorlen-contact-page">
    <header className="vorlen-nav"><VorlenBrand/><nav><Link to="/">About Vorlen</Link><Link to="/careers">Careers</Link></nav><div className="vorlen-nav-actions"><Link className="vorlen-text-link" to="/login">Sign in</Link></div><div className="vorlen-mobile-signin"><Link to="/login">Client or recruiter sign in</Link></div></header>
    <main className="vorlen-contact-main">
      <section className="vorlen-contact-intro"><p className="vorlen-eyebrow">CONTACT VORLEN</p><h1>Let's talk about what you need.</h1><p>Hiring for a permanent role, asking about an application or exploring the Vorlen partner network? Send the context and we’ll route it properly.</p><div className="vorlen-contact-direct"><span>Prefer email?</span><a href="mailto:contact@vorlen.co.uk">contact@vorlen.co.uk</a></div></section>
      <section className="vorlen-contact-card">
        {sent?<div className="vorlen-contact-success"><strong>Thanks for getting in touch.</strong><p>We have received your message. Keep reference {reference.slice(0,8)} for follow-up. For urgent matters email <a href="mailto:contact@vorlen.co.uk">contact@vorlen.co.uk</a>.</p><Link to="/">Back to Vorlen</Link></div>:<form onSubmit={submit}>
          <fieldset><legend>What can we help with?</legend><div className="vorlen-reason-grid">{reasons.map(({value,label,icon:Icon})=><label className={reason===value?'active':''} key={value}><input type="radio" name="reason" value={value} checked={reason===value} onChange={()=>setReason(value)}/><Icon size={18}/><span>{label}</span></label>)}</div></fieldset>
          <div className="vorlen-contact-fields"><label>Name<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="full">Company <span>(optional)</span><input value={company} onChange={e=>setCompany(e.target.value)}/></label>{reason==='employer'&&<label className="full">Vacancy or role you are hiring for <span>(optional)</span><input value={roleTitle} onChange={e=>setRoleTitle(e.target.value)} placeholder="e.g. Electrical Design Engineer"/></label>}<label className="full">Tell us what you need<textarea required minLength={15} maxLength={5000} rows={6} value={message} onChange={e=>setMessage(e.target.value)} placeholder="A short outline is enough to start."/></label></div>
          <label style={{position:'absolute',left:'-10000px'}} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label>{error&&<p role="alert" className="form-error">{error}</p>}<button className="vorlen-button" type="submit" disabled={busy}>{busy?'Sending enquiry…':'Send enquiry'} <ArrowRight size={16}/></button>
          <p className="vorlen-contact-note">By contacting Vorlen you are providing information so we can respond to your enquiry. See our <Link to="/privacy">privacy notice</Link>.</p>
        </form>}
      </section>
    </main>
  </div>
}