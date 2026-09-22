import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,BriefcaseBusiness,Network,Users} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import {setSeo} from '../lib/seo';

const reasons=[
  {value:'employer',label:'I need to hire',icon:BriefcaseBusiness},
  {value:'candidate',label:'I have a candidate or application question',icon:Users},
  {value:'partner',label:'I want to discuss the partner network',icon:Network}
];

export default function Contact(){
  const[name,setName]=useState(''),[email,setEmail]=useState(''),[company,setCompany]=useState(''),[reason,setReason]=useState('employer'),[message,setMessage]=useState(''),[sent,setSent]=useState(false);
  useEffect(()=>setSeo({title:'Contact Vorlen | UK Permanent Recruitment',description:'Talk to Vorlen about a permanent vacancy, candidate query or recruitment partnership.',path:'/contact'}),[]);
  function submit(e:any){
    e.preventDefault();
    const subject=encodeURIComponent(reason==='employer'?'Hiring enquiry — Vorlen':reason==='partner'?'Partner enquiry — Vorlen':'Candidate enquiry — Vorlen');
    const body=encodeURIComponent(`Name: ${name}\nEmail: ${email}\nCompany: ${company||'—'}\nEnquiry: ${reason}\n\n${message}`);
    window.location.href=`mailto:contact@vorlen.co.uk?subject=${subject}&body=${body}`;
    setSent(true);
  }
  return <div className="vorlen-contact-page">
    <header className="vorlen-nav"><VorlenBrand/><nav><Link to="/">About Vorlen</Link><Link to="/careers">Careers</Link></nav><div className="vorlen-nav-actions"><Link className="vorlen-text-link" to="/login">Sign in</Link></div></header>
    <main className="vorlen-contact-main">
      <section className="vorlen-contact-intro"><p className="vorlen-eyebrow">CONTACT VORLEN</p><h1>Start with what you need.</h1><p>Hiring for a permanent role, asking about an application or exploring the Vorlen partner network? Send the context and we’ll route it properly.</p><div className="vorlen-contact-direct"><span>Prefer email?</span><a href="mailto:contact@vorlen.co.uk">contact@vorlen.co.uk</a></div></section>
      <section className="vorlen-contact-card">
        {sent?<div className="vorlen-contact-success"><strong>Your email app should now be open.</strong><p>If it did not open, email <a href="mailto:contact@vorlen.co.uk">contact@vorlen.co.uk</a> directly.</p><Link to="/">Back to Vorlen</Link></div>:<form onSubmit={submit}>
          <fieldset><legend>What can we help with?</legend><div className="vorlen-reason-grid">{reasons.map(({value,label,icon:Icon})=><label className={reason===value?'active':''} key={value}><input type="radio" name="reason" value={value} checked={reason===value} onChange={()=>setReason(value)}/><Icon size={18}/><span>{label}</span></label>)}</div></fieldset>
          <div className="vorlen-contact-fields"><label>Name<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="full">Company <span>(optional)</span><input value={company} onChange={e=>setCompany(e.target.value)}/></label><label className="full">Tell us what you need<textarea required rows={6} value={message} onChange={e=>setMessage(e.target.value)} placeholder="A short outline is enough to start."/></label></div>
          <button className="vorlen-button" type="submit">Start conversation <ArrowRight size={16}/></button>
          <p className="vorlen-contact-note">By contacting Vorlen you are providing information so we can respond to your enquiry. See our <Link to="/privacy">privacy notice</Link>.</p>
        </form>}
      </section>
    </main>
  </div>
}