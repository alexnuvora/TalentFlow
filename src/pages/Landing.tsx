import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,CheckCircle2,ChevronDown,ShieldCheck,Users,BriefcaseBusiness,Search,Handshake} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import {orgSchema,setSeo} from '../lib/seo';

const faqs=[
  ['What does Vorlen do?','Vorlen is a UK permanent recruitment agency. We work with employers on genuine vacancies, source and assess candidates, coordinate introductions and interviews, and support the process through to placement.'],
  ['How does Vorlen assess candidates?','Recruiters review job-related evidence, experience and suitability against the vacancy. Technology may assist with evidence review, but candidate progression and client introductions remain human-reviewed.'],
  ['Where does Vorlen recruit?','Vorlen supports permanent recruitment for employers across the United Kingdom.'],
  ['Can candidates apply directly?','Yes. Candidates can browse published opportunities through Vorlen Careers and apply securely online.'],
  ['Does Vorlen work with recruitment partners?','Yes. Vorlen operates a selective partner network subject to formal terms, onboarding and approval.']
];

const services=[
  {icon:Search,title:'Focused candidate search',copy:'We work from the vacancy outward — defining what matters, sourcing relevant people and reviewing evidence against the actual role.'},
  {icon:Users,title:'Human-reviewed introductions',copy:'You receive candidates who have been reviewed for the role, not an unfiltered stream of CVs.'},
  {icon:Handshake,title:'Connected hiring support',copy:'Feedback, interviews and placement activity stay connected so the process keeps moving.'}
];

const steps=[
  ['01','Define the brief','We capture the role, hiring context, requirements and agreed terms before the search begins.'],
  ['02','Search the market','We combine applications with proactive sourcing where appropriate to reach relevant candidates.'],
  ['03','Review the evidence','Recruiters assess job-related experience and suitability before any client introduction.'],
  ['04','Progress the hire','We coordinate introductions, feedback, interviews and placement support through to outcome.']
];

export default function Landing(){
  useEffect(()=>setSeo({
    title:'Vorlen | UK Permanent Recruitment Agency',
    description:'Vorlen helps UK employers make better permanent hires through focused candidate search, human-reviewed introductions and connected recruitment delivery.',
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
        <Link className="vp-signin" to="/login">Sign in</Link>
        <Link className="vp-btn vp-btn-small" to="/contact">Discuss a vacancy</Link>
      </div>
    </header>

    <main id="main">
      <section className="vp-hero">
        <div className="vp-hero-copy">
          <p className="vp-kicker">UK PERMANENT RECRUITMENT</p>
          <h1>Better hires begin with a better search.</h1>
          <p className="vp-lead">Vorlen helps employers find and hire people for permanent roles through focused sourcing, careful candidate review and a recruitment process that stays clear from brief to placement.</p>
          <div className="vp-hero-actions">
            <Link className="vp-btn" to="/contact">Discuss your vacancy <ArrowRight size={17}/></Link>
            <Link className="vp-text-link" to="/careers">Looking for a role? View opportunities</Link>
          </div>
          <div className="vp-proof-row" aria-label="Vorlen service principles">
            <span><CheckCircle2 size={16}/> Permanent recruitment</span>
            <span><CheckCircle2 size={16}/> UK-wide search</span>
            <span><CheckCircle2 size={16}/> Human-reviewed introductions</span>
          </div>
        </div>

        <aside className="vp-hero-panel" aria-label="What employers can expect">
          <div className="vp-panel-label">WHAT YOU CAN EXPECT</div>
          <div className="vp-panel-item">
            <span>01</span>
            <div><strong>A clear brief</strong><p>We start with the vacancy, not the CV database.</p></div>
          </div>
          <div className="vp-panel-item">
            <span>02</span>
            <div><strong>A focused search</strong><p>Sourcing is shaped around the role and hiring context.</p></div>
          </div>
          <div className="vp-panel-item">
            <span>03</span>
            <div><strong>Reviewed introductions</strong><p>Candidate evidence is considered before it reaches you.</p></div>
          </div>
          <div className="vp-panel-item">
            <span>04</span>
            <div><strong>Momentum through the process</strong><p>Feedback, interviews and next steps stay connected.</p></div>
          </div>
        </aside>
      </section>

      <section className="vp-positioning">
        <div>
          <p className="vp-kicker">WHY VORLEN</p>
          <h2>You do not need more CVs. You need a clearer path to the right person.</h2>
        </div>
        <p>Recruitment becomes expensive when time is spent reviewing irrelevant applications, chasing feedback and reconstructing context across emails. Vorlen is designed to keep the search disciplined and the hiring process moving.</p>
      </section>

      <section className="vp-services">
        <div className="vp-section-head">
          <p className="vp-kicker">WHAT WE DO</p>
          <h2>Permanent recruitment, handled properly.</h2>
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

      <section className="vp-process">
        <div className="vp-process-intro">
          <p className="vp-kicker vp-kicker-light">OUR APPROACH</p>
          <h2>A recruitment process built around the hire.</h2>
          <p>Technology supports the administration and evidence trail. Recruiters remain responsible for judgement, progression and client introductions.</p>
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
          <p>Tell us who you need, what the role involves and what a successful hire looks like. We will build the search around that.</p>
          <Link className="vp-btn" to="/contact">Discuss your vacancy <ArrowRight size={16}/></Link>
        </article>
        <article className="vp-candidate">
          <Users size={24}/>
          <p className="vp-kicker">FOR CANDIDATES</p>
          <h2>Looking for your next move?</h2>
          <p>Browse published opportunities, understand the role before you apply and submit your details securely through Vorlen Careers.</p>
          <Link className="vp-outline-link" to="/careers">View current opportunities <ArrowRight size={16}/></Link>
        </article>
      </section>

      <section className="vp-confidence">
        <div>
          <ShieldCheck size={26}/>
          <p className="vp-kicker">RECRUITMENT WITH ACCOUNTABILITY</p>
          <h2>Technology can support the process. People remain responsible for the decisions.</h2>
        </div>
        <div className="vp-confidence-copy">
          <p>Vorlen uses technology to connect vacancy information, candidate evidence, client feedback and recruitment activity. It does not replace recruiter judgement.</p>
          <p>Candidate progression and client introductions remain subject to human review, with recruitment and privacy controls built into the operating process.</p>
        </div>
      </section>

      <section className="vp-faq">
        <div className="vp-faq-head">
          <p className="vp-kicker">COMMON QUESTIONS</p>
          <h2>Before you work with Vorlen.</h2>
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
          <h2>Start with the vacancy.</h2>
          <p>Tell us about the role and we will take it from there.</p>
        </div>
        <Link className="vp-final-btn" to="/contact">Discuss a vacancy <ArrowRight size={17}/></Link>
      </section>
    </main>

    <footer className="vp-footer">
      <div className="vp-footer-brand"><VorlenBrand/><p>Permanent recruitment, properly run.</p></div>
      <div><strong>Employers</strong><Link to="/employers">For employers</Link><Link to="/services/permanent-recruitment">Permanent recruitment</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link><Link to="/services/recruitment-for-smes">Recruitment for SMEs</Link></div>
      <div><strong>Candidates</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/candidate-terms">Candidate terms</Link></div>
      <div><strong>Vorlen</strong><Link to="/partners">Partner network</Link><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><Link to="/contact">Contact</Link></div>
      <div className="vp-footer-base"><span>© {new Date().getFullYear()} Vorlen</span><span>VORLEN T/A IVY AND PEARLS LTD · Company No. 17387520</span></div>
    </footer>
  </div>
}
