import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,CheckCircle2,ChevronDown,ShieldCheck,Users,BriefcaseBusiness,Search,Handshake,Facebook,Linkedin} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import GooglePreferredSource from '../components/GooglePreferredSource';
import {orgSchema,setSeo} from '../lib/seo';

const faqs=[
  ['What does Vorlen do?','We help UK businesses recruit permanent staff. Tell us about the vacancy and we will discuss the search, review suitable candidates and help arrange interviews.'],
  ['How does Vorlen assess candidates?','A recruiter looks at each person’s relevant experience and suitability for the role before recommending them to an employer.'],
  ['Where does Vorlen recruit?','Vorlen supports permanent recruitment for employers across the United Kingdom.'],
  ['Can candidates apply directly?','Yes. Candidates can browse published opportunities through Vorlen Careers and apply securely online.'],
  ['Does Vorlen work with recruitment partners?','Yes. Vorlen operates a selective partner network subject to formal terms, onboarding and approval.'],
  ['What happens after I enquire?','We will read through the details, get in touch to understand what you need and explain how we could help.']
];

const services=[
  {icon:Search,title:'Finding the right candidates',copy:'We look for people whose skills and experience match your vacancy, including candidates who may not be actively applying.'},
  {icon:Users,title:'Candidates we have spoken to',copy:'We review suitability before putting anyone forward, so you spend less time sorting through unsuitable CVs.'},
  {icon:Handshake,title:'Help through the hiring process',copy:'From arranging interviews to keeping everyone informed, we are here to help things run smoothly.'}
];

const steps=[
  ['01','Define the brief','We find out who you are hiring, what they will be doing and what matters most to your business.'],
  ['02','Search the market','We advertise and search for suitable people, including those who are not actively looking.'],
  ['03','Speak to candidates','We review their experience and discuss the role with them before making an introduction.'],
  ['04','Arrange the next steps','We help with interviews, feedback and the steps leading up to an offer.']
];

export default function Landing(){
  useEffect(()=>setSeo({
    title:'Vorlen | UK Permanent Recruitment Agency',
    description:'Vorlen helps UK businesses recruit permanent staff. We find suitable candidates, review their experience and help employers through the hiring process.',
    path:'/',
    jsonLd:[
      orgSchema(),
      {'@context':'https://schema.org','@type':'Service','@id':'https://www.vorlen.co.uk/#permanent-recruitment',name:'Permanent recruitment services',provider:{'@id':'https://www.vorlen.co.uk/#organization'},areaServed:{'@type':'Country',name:'United Kingdom'},serviceType:'Permanent recruitment',description:'Employer-led permanent recruitment covering vacancy briefing, candidate sourcing, assessment, introduction, interview coordination and placement support.'},
      {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqs.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
    ]
  }),[]);

  return <div className="vp-site">
    <a className="skip-link" href="#main">Skip to content</a>

    <header className="vp-nav">
      <VorlenBrand/>
      <nav aria-label="Primary navigation">
        <Link to="/employers">Employers</Link>
        <Link to="/services/permanent-recruitment">Services</Link>
        <Link to="/careers">Careers</Link>
        <Link to="/partners">Partners</Link>
      </nav>
      <div className="vp-nav-actions">
        <Link className="vp-signin" to="/login" style={{display:"inline-flex",alignItems:"center",whiteSpace:"nowrap"}}>Sign in</Link>
        <Link className="vp-btn vp-btn-small" to="/contact">Discuss a vacancy</Link>
      </div>
    </header>
    <nav className="vp-mobile-account" aria-label="Mobile account and candidate access"><Link to="/login">Client or recruiter sign in</Link><Link to="/careers">Find a job</Link></nav>

    <main id="main">
      <section className="vp-hero">
        <div className="vp-hero-copy">
          <p className="vp-kicker">UK PERMANENT RECRUITMENT</p>
          <h1>Good people make a good business. Let's find yours.</h1>
          <p className="vp-lead">Need someone new on your team? Tell us who you are looking for. We will help you find suitable people, arrange introductions and make hiring a little easier.</p>
          <div className="vp-hero-actions">
            <Link className="vp-btn" to="/contact">Discuss your vacancy <ArrowRight size={17}/></Link>
            <Link className="vp-text-link" to="/careers">Looking for a role? View opportunities</Link>
          </div>
          <div className="vp-proof-row" aria-label="Vorlen service principles">
            <span><CheckCircle2 size={16}/> Permanent recruitment</span>
            <span><CheckCircle2 size={16}/> UK-wide search</span>
            <span><CheckCircle2 size={16}/> Candidates we have spoken to</span>
          </div>
        </div>

        <aside className="vp-hero-panel" aria-label="What employers can expect">
          <div className="vp-panel-label">WHAT YOU CAN EXPECT</div>
          <div className="vp-panel-item">
            <span>01</span>
            <div><strong>Tell us what you need</strong><p>We will ask about the role, your team and what you are looking for.</p></div>
          </div>
          <div className="vp-panel-item">
            <span>02</span>
            <div><strong>We will start looking</strong><p>We search for people with the right experience for the job.</p></div>
          </div>
          <div className="vp-panel-item">
            <span>03</span>
            <div><strong>Meet suitable candidates</strong><p>We review candidates before introducing them to you.</p></div>
          </div>
          <div className="vp-panel-item">
            <span>04</span>
            <div><strong>Help until you've hired</strong><p>We will help organise interviews and keep you updated.</p></div>
          </div>
        </aside>
      </section>

      <section className="vp-positioning">
        <div>
          <p className="vp-kicker">WHY VORLEN</p>
          <h2>Recruitment shouldn't take over your working day.</h2>
        </div>
        <p>Hiring takes time, especially when you are running a business as well. We can take some of that work off your hands, from finding candidates to arranging interviews.</p>
      </section>

      <section className="vp-services">
        <div className="vp-section-head">
          <p className="vp-kicker">WHAT WE DO</p>
          <h2>We help you hire permanent staff.</h2>
          <Link to="/services/permanent-recruitment">Explore our recruitment service <ArrowRight size={15}/></Link>
        </div>
        <div className="vp-service-grid">
          {services.map(({icon:Icon,title,copy})=><article key={title}>
            <Icon size={22}/>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>)}
        </div>
      </section>

      <section className="vp-specialisms" aria-labelledby="vp-specialisms-title">
        <div className="vp-section-head">
          <p className="vp-kicker">RECRUITMENT SPECIALISMS</p>
          <h2 id="vp-specialisms-title">Looking for someone with the right experience?</h2>
          <p>Whether you need an engineer, an accountant or someone to keep the office running, tell us about the position and we will talk through your options.</p>
        </div>
        <div className="vp-specialisms-grid">
          {[
            ['Engineering & technical','Permanent roles requiring relevant technical knowledge, qualifications and practical experience.'],
            ['Office & administration','Reliable administrative and operational support, from office staff to experienced coordinators.'],
            ['Accounting & finance','Finance and accounts positions where accuracy, experience and attention to detail count.']
          ].map(([title,copy])=><article key={title}><h3>{title}</h3><p>{copy}</p><Link to="/contact">Discuss a role <ArrowRight size={15}/></Link></article>)}
        </div>
        <p className="vp-section-note">Based in Greater Manchester, supporting permanent recruitment enquiries across the UK. Every assignment is reviewed individually.</p>
      </section>

      <section className="vp-employer-assurance" aria-labelledby="vp-assurance-title">
        <div><p className="vp-kicker">FOR HIRING TEAMS</p><h2 id="vp-assurance-title">Get to know the person behind the CV.</h2></div>
        <div><p>A CV only tells part of the story. We look at relevant experience and suitability before introducing someone, so you have more to go on when deciding who to interview.</p><Link className="vp-text-link" to="/employers">How we support employers <ArrowRight size={15}/></Link></div>
      </section>

      <section className="vp-process">
        <div className="vp-process-intro">
          <p className="vp-kicker vp-kicker-light">OUR APPROACH</p>
          <h2>Here's how we work with you.</h2>
          <p>You'll deal with people who understand your vacancy and can talk you through the next steps.</p>
        </div>
        <div className="vp-process-list">
          {steps.map(([n,title,copy])=><article key={n}>
            <span>{n}</span>
            <div><h3>{title}</h3><p>{copy}</p></div>
          </article>)}
        </div>
      </section>

      <section className="vp-audiences">
        <article className="vp-employer">
          <BriefcaseBusiness size={24}/>
          <p className="vp-kicker">FOR EMPLOYERS</p>
          <h2>Hiring for a permanent role?</h2>
          <p>Tell us about your vacancy and the kind of person you are hoping to find. We will discuss how we can help.</p>
          <Link className="vp-btn" to="/contact">Discuss your vacancy <ArrowRight size={16}/></Link>
        </article>
        <article className="vp-candidate">
          <Users size={24}/>
          <p className="vp-kicker">FOR CANDIDATES</p>
          <h2>Looking for your next move?</h2>
          <p>Take a look at our latest vacancies. If one interests you, you can apply through Vorlen Careers.</p>
          <Link className="vp-outline-link" to="/careers">View current opportunities <ArrowRight size={16}/></Link>
        </article>
      </section>

      <section className="vp-confidence">
        <div>
          <ShieldCheck size={26}/>
          <p className="vp-kicker">RECRUITMENT WITH ACCOUNTABILITY</p>
          <h2>Real people, making recruitment decisions.</h2>
        </div>
        <div className="vp-confidence-copy">
          <p className="vp-confidence-intro">We take care with every introduction. Our team reviews suitability and shares candidate information through the right channels.</p>
          <div className="vp-assurance-list">
            <article className="vp-assurance-item"><span className="vp-assurance-number" aria-hidden="true">01</span><div><h3>Assessed against your vacancy</h3><p>We look at the experience and skills you told us matter.</p></div></article>
            <article className="vp-assurance-item"><span className="vp-assurance-number" aria-hidden="true">02</span><div><h3>Shared with permission</h3><p>We only share candidate details when we have the right permission.</p></div></article>
            <article className="vp-assurance-item"><span className="vp-assurance-number" aria-hidden="true">03</span><div><h3>Decisions stay human</h3><p>Our team checks introductions. You decide who you'd like to meet.</p></div></article>
          </div>
        </div>
      </section>

      <section className="vp-discover" aria-labelledby="vp-discover-title">
        <div className="vp-section-head">
          <p className="vp-kicker">CURRENT OPPORTUNITIES</p>
          <h2 id="vp-discover-title">See who's hiring.</h2>
          <p>Browse our current vacancies and apply online. We will add new opportunities as they become available.</p>
          <Link to="/careers">Browse live opportunities <ArrowRight size={16}/></Link>
        </div>
        <div className="vp-discover-cards">
          <article><BriefcaseBusiness size={24}/><h3>Hiring for your team?</h3><p>Tell us the job title, where the role is based and what you are looking for. We will take it from there.</p><Link to="/contact">Start an employer enquiry <ArrowRight size={16}/></Link></article>
          <article><Users size={24}/><h3>Considering your next role?</h3><p>See a role that sounds right for you? Read the details and apply through our careers page.</p><Link to="/careers">View opportunities <ArrowRight size={16}/></Link></article>
        </div>
      </section>

      <section className="vp-faq">
        <div className="vp-faq-head">
          <p className="vp-kicker">COMMON QUESTIONS</p>
          <h2>A few things you might want to know.</h2>
        </div>
        <div className="vp-faq-list">
          {faqs.map(([q,a])=><details key={q}>
            <summary><span>{q}</span><ChevronDown size={18}/></summary>
            <p>{a}</p>
          </details>)}
        </div>
      </section>

      <section className="vp-final">
        <div>
          <p className="vp-kicker vp-kicker-light">HAVE A ROLE TO FILL?</p>
          <h2>Let's talk about your vacancy.</h2>
          <p>Tell us what you need and we will get back to you.</p>
        </div>
        <Link className="vp-final-btn" to="/contact">Discuss a vacancy <ArrowRight size={17}/></Link>
      </section>
    </main>

    <footer className="vp-footer">
      <div className="vp-footer-brand"><VorlenBrand/><p>Good recruitment starts with a conversation.</p><div className="vp-footer-socials" aria-label="Vorlen social media"><a href="https://www.facebook.com/share/19pqmJPH3v/" target="_blank" rel="noopener noreferrer" aria-label="Vorlen on Facebook"><Facebook size={18}/></a><a href="https://www.linkedin.com/company/vorlen/" target="_blank" rel="noopener noreferrer" aria-label="Vorlen on LinkedIn"><Linkedin size={18}/></a></div><div className="google-preferred-source"><GooglePreferredSource/></div></div>
      <div><strong>Employers</strong><Link to="/employers">For employers</Link><Link to="/services/permanent-recruitment">Permanent recruitment</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link><Link to="/services/recruitment-for-smes">Recruitment for SMEs</Link></div>
      <div><strong>Candidates</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/candidate-terms">Candidate terms</Link><Link to="/privacy">Privacy policy</Link></div>
      <div><strong>Vorlen</strong><Link to="/partners">Partner network</Link><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><Link to="/contact">Contact</Link><Link to="/accessibility">Accessibility</Link></div>
      <div className="vp-footer-base"><span>© {new Date().getFullYear()} Vorlen</span><span>Vorlen Ltd · Company No. 17387520 · Registered in England and Wales · Registered office: Rochdale, OL16 2EP · ICO Ref: ZC275029</span></div>
    </footer>
  </div>
}
