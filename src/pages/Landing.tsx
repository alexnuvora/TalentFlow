import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,CheckCircle2,ChevronDown,ShieldCheck,Users,BriefcaseBusiness,Search,Handshake,Facebook,Linkedin} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import GooglePreferredSource from '../components/GooglePreferredSource';
import {orgSchema,setSeo} from '../lib/seo';

const faqs=[
  ['What does Vorlen do?','Vorlen is a UK permanent recruitment agency. We work with employers on genuine vacancies, source and assess candidates, coordinate introductions and interviews, and support the process through to placement.'],
  ['How does Vorlen assess candidates?','Recruiters review job-related evidence, experience and suitability against the vacancy. Technology may assist with evidence review, but candidate progression and client introductions remain human-reviewed.'],
  ['Where does Vorlen recruit?','Vorlen supports permanent recruitment for employers across the United Kingdom.'],
  ['Can candidates apply directly?','Yes. Candidates can browse published opportunities through Vorlen Careers and apply securely online.'],
  ['Does Vorlen work with recruitment partners?','Yes. Vorlen operates a selective partner network subject to formal terms, onboarding and approval.'],
  ['What happens after I enquire?','Your enquiry is recorded for the Vorlen team. We review the role and hiring requirements before discussing whether and how we can assist.']
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
        <Link className="vp-signin" to="/login" style={{display:"inline-flex",alignItems:"center",whiteSpace:"nowrap"}}>Sign in</Link>
        <Link className="vp-btn vp-btn-small" to="/contact">Discuss a vacancy</Link>
      </div>
    </header>
    <nav className="vp-mobile-account" aria-label="Mobile account and candidate access"><Link to="/login">Client or recruiter sign in</Link><Link to="/careers">Find a job</Link></nav>

    <main id="main">
      <section className="vp-hero">
        <div className="vp-hero-copy">
          <p className="vp-kicker">UK PERMANENT RECRUITMENT</p>
          <h1>Find the right people. Hire with confidence.</h1>
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

      <section className="vp-specialisms" aria-labelledby="vp-specialisms-title">
        <div className="vp-section-head">
          <p className="vp-kicker">RECRUITMENT SPECIALISMS</p>
          <h2 id="vp-specialisms-title">Focused recruitment for the roles your business needs.</h2>
          <p>From technical vacancies to business support, each search starts with your actual requirements. Talk to us about your role and the experience that matters.</p>
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
        <div><p className="vp-kicker">FOR HIRING TEAMS</p><h2 id="vp-assurance-title">A shortlist should tell you more than a CV can.</h2></div>
        <div><p>We focus on the role requirements, candidate evidence and permission to share information, so introductions arrive with useful context — not as unexplained CV attachments.</p><Link className="vp-text-link" to="/employers">How we support employers <ArrowRight size={15}/></Link></div>
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
          <p className="vp-confidence-intro">Every candidate introduction follows a clear, considered process — from role-specific assessment to secure sharing and human approval.</p>
          <div className="vp-assurance-list">
            <article className="vp-assurance-item"><span className="vp-assurance-number" aria-hidden="true">01</span><div><h3>Assessed against your vacancy</h3><p>We review relevant experience and evidence against the requirements of your role.</p></div></article>
            <article className="vp-assurance-item"><span className="vp-assurance-number" aria-hidden="true">02</span><div><h3>Shared with permission</h3><p>Approved candidate information and a client-safe CV are shared only through our controlled introduction process.</p></div></article>
            <article className="vp-assurance-item"><span className="vp-assurance-number" aria-hidden="true">03</span><div><h3>Decisions stay human</h3><p>Our team reviews introductions, while hiring managers can securely give feedback and request interviews.</p></div></article>
          </div>
        </div>
      </section>

      <section className="vp-discover" aria-labelledby="vp-discover-title">
        <div className="vp-section-head">
          <p className="vp-kicker">CURRENT OPPORTUNITIES</p>
          <h2 id="vp-discover-title">Explore roles being recruited now.</h2>
          <p>Our careers page displays the current published opportunities, with the role details and a secure application route. The list stays up to date as vacancies change.</p>
          <Link to="/careers">Browse live opportunities <ArrowRight size={16}/></Link>
        </div>
        <div className="vp-discover-cards">
          <article><BriefcaseBusiness size={24}/><h3>Hiring for your team?</h3><p>Share the title, location, salary range and essential requirements. We will review the brief and discuss the next step.</p><Link to="/contact">Start an employer enquiry <ArrowRight size={16}/></Link></article>
          <article><Users size={24}/><h3>Considering your next role?</h3><p>Review published vacancies and apply directly when there is a suitable opportunity. New roles are added to Vorlen Careers.</p><Link to="/careers">View opportunities <ArrowRight size={16}/></Link></article>
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
      <div className="vp-footer-brand"><VorlenBrand/><p>Permanent recruitment, properly run.</p><div className="vp-footer-socials" aria-label="Vorlen social media"><a href="https://www.facebook.com/share/19pqmJPH3v/" target="_blank" rel="noopener noreferrer" aria-label="Vorlen on Facebook"><Facebook size={18}/></a><a href="https://www.linkedin.com/company/vorlen/" target="_blank" rel="noopener noreferrer" aria-label="Vorlen on LinkedIn"><Linkedin size={18}/></a></div><div className="google-preferred-source"><GooglePreferredSource/></div></div>
      <div><strong>Employers</strong><Link to="/employers">For employers</Link><Link to="/services/permanent-recruitment">Permanent recruitment</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link><Link to="/services/recruitment-for-smes">Recruitment for SMEs</Link></div>
      <div><strong>Candidates</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/candidate-terms">Candidate terms</Link><Link to="/privacy">Privacy policy</Link></div>
      <div><strong>Vorlen</strong><Link to="/partners">Partner network</Link><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><Link to="/contact">Contact</Link><Link to="/accessibility">Accessibility</Link></div>
      <div className="vp-footer-base"><span>© {new Date().getFullYear()} Vorlen</span><span>Vorlen Ltd · Company No. 17387520 · Registered in England and Wales · Registered office: Rochdale, OL16 2EP · ICO Ref: ZC275029</span></div>
    </footer>
  </div>
}
