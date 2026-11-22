import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,CheckCircle2,Handshake,SearchCheck,Users} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import {orgSchema,setSeo} from '../lib/seo';

const values=[
  {icon:Users,title:'People before paperwork',copy:'We take time to understand the people behind the job description and the team they would join.'},
  {icon:SearchCheck,title:'Shortlists with a reason',copy:'Candidates are reviewed by a person before introduction. We explain the match rather than sending a stack of CVs.'},
  {icon:Handshake,title:'Straightforward conversations',copy:'We discuss the brief, expectations and commercial terms before a search begins.'}
];
export default function About(){
  useEffect(()=>setSeo({title:'About Vorlen | People-first UK Recruitment',description:'Meet Vorlen, a UK permanent recruitment company helping employers hire with considered shortlists, clear terms and a human approach.',path:'/about',jsonLd:[orgSchema()]}),[]);
  return <div className="vp-site">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="vp-nav"><VorlenBrand/><nav aria-label="Primary navigation"><Link to="/employers">Employers</Link><Link to="/services/permanent-recruitment">Services</Link><Link to="/about" aria-current="page">About us</Link><Link to="/careers">Careers</Link><Link to="/partners">Partners</Link></nav><div className="vp-nav-actions"><Link className="vp-signin" to="/login">Sign in</Link><Link className="vp-btn vp-btn-small" to="/contact">Discuss a vacancy</Link></div></header>
    <nav className="vp-mobile-account" aria-label="Mobile navigation"><Link to="/about">About Vorlen</Link><Link to="/careers">Find a job</Link><Link to="/contact">Contact us</Link></nav>
    <main id="main">
      <section className="vp-hero" style={{minHeight:'auto'}}>
        <div className="vp-hero-media" aria-hidden="true"><img src="/images/vorlen-hero-colleague.webp" alt="" decoding="async"/></div>
        <div className="vp-hero-copy"><p className="vp-kicker">ABOUT VORLEN</p><h1>Good recruitment starts with understanding people.</h1><p className="vp-lead">Vorlen is a UK permanent recruitment company helping businesses find people who can make a real difference. We bring together a thoughtful, human approach and practical recruitment technology to make hiring clearer and less time-consuming.</p><div className="vp-hero-actions"><Link className="vp-btn" to="/contact?reason=employer">Talk to us about hiring <ArrowRight size={17}/></Link></div></div>
      </section>
      <section className="vp-faq" style={{maxWidth:1100,margin:'0 auto',padding:'clamp(36px,6vw,80px) 24px'}}>
        <p className="vp-kicker">WHO WE ARE</p><h2>Recruitment without unnecessary complications.</h2>
        <p>We work with UK employers who need permanent staff, from growing businesses making a key hire to established teams looking for specialist skills. We support roles across engineering, technology, sales, finance and business operations, depending on the vacancy and brief.</p>
        <p>We believe a recruitment partner should understand the job, be open about costs and respect everyone's time. That means asking the right questions, speaking to candidates and explaining why someone could be right for the role.</p>
      </section>
      <section className="vp-faq" style={{background:'#f5f7f9',padding:'clamp(36px,6vw,80px) 24px'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}><p className="vp-kicker">HOW WE WORK</p><h2>A considered approach to every hire.</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:20,marginTop:30}}>{values.map(({icon:Icon,title,copy})=><article key={title} style={{background:'white',borderRadius:16,padding:26}}><Icon size={28} aria-hidden="true"/><h3>{title}</h3><p>{copy}</p></article>)}</div></div>
      </section>
      <section className="vp-faq" style={{maxWidth:1100,margin:'0 auto',padding:'clamp(36px,6vw,80px) 24px'}}>
        <p className="vp-kicker">WHAT EMPLOYERS CAN EXPECT</p><h2>Clear steps. Better conversations.</h2>
        <p>First we understand your vacancy, including the skills, salary, location and hiring priorities. Then we agree the proposed approach and terms, search for suitable people, review their experience and help coordinate interviews and feedback.</p>
        <p>Our standard permanent placement fee is <strong>15% of the agreed first-year salary</strong>, subject to written terms. We confirm the fee and payment terms before starting a search.</p>
        <p><CheckCircle2 size={18} style={{verticalAlign:'middle'}}/> Based in Greater Manchester, supporting employers across the UK.</p>
      </section>
      <section className="vp-final"><div><p className="vp-kicker vp-kicker-light">LET'S WORK TOGETHER</p><h2>Tell us who you're looking for.</h2><p>Whether you have a vacancy now or are planning your next hire, we'd be glad to hear from you.</p></div><Link className="vp-final-btn" to="/contact?reason=employer">Discuss a vacancy <ArrowRight size={17}/></Link></section>
    </main>
    <footer className="vp-footer"><div className="vp-footer-brand"><VorlenBrand/><p>Good recruitment starts with a conversation.</p></div><div><strong>Explore</strong><Link to="/">Home</Link><Link to="/about">About us</Link><Link to="/employers">For employers</Link><Link to="/careers">Careers</Link></div><div><strong>Get in touch</strong><Link to="/contact">Contact</Link><Link to="/partners">Partner network</Link><Link to="/privacy">Privacy policy</Link><Link to="/accessibility">Accessibility</Link></div><div className="vp-footer-base"><span>© {new Date().getFullYear()} Vorlen Ltd</span><span>Registered in England and Wales · Company No. 17387520</span></div></footer>
  </div>;
}
