import {CookieSettingsLink} from '../components/WebsitePrivacy';
import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,CheckCircle2,ChevronDown,ShieldCheck,Users,BriefcaseBusiness,Search,Handshake,Facebook,Linkedin,Building2} from 'lucide-react';
import MarketingHeader from '../components/MarketingHeader';
import VorlenBrand from '../components/VorlenBrand';
import DirectoryVerificationBadge from '../components/DirectoryVerificationBadge';
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

    <MarketingHeader/>
    <main id="main">
      <section className="vp-hero">
        <div className="vp-hero-media" aria-hidden="true">
          <img
            src="/images/vorlen-hero-colleague.webp"
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <div className="vp-hero-copy">
          <p className="vp-kicker">UK PERMANENT RECRUITMENT</p>
          <h1>Hiring permanent staff? Start with a better shortlist.</h1>
          <p className="vp-lead">Tell us who you need to hire and what the job involves. We search for suitable people, speak to them about the role and explain why we think they are worth meeting.</p><p className="vp-hero-fee">Our standard fee is 15% of the agreed first-year salary, subject to written terms. We agree the fee and payment terms with you before starting.</p>
          <div className="vp-hero-actions">
            <Link className="vp-btn" to="/contact?reason=employer">Discuss your vacancy <ArrowRight size={17}/></Link>
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
            <div><strong>Tell us what you need</strong><p>We ask about the work, salary and experience you need.</p></div>
          </div>
          <div className="vp-panel-item">
            <span>02</span>
            <div><strong>We will start looking</strong><p>We search for people whose experience fits your brief.</p></div>
          </div>
        </aside>
      </section>

      <section className="vp-people-feature" aria-labelledby="vp-people-feature-title">
        <div className="vp-people-feature-image">
          <img
            src="/images/vorlen-team-meeting.webp"
            alt="Colleagues sharing ideas during a workplace meeting"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="vp-people-feature-copy">
          <p className="vp-kicker">PEOPLE FIRST, ALWAYS</p>
          <h2 id="vp-people-feature-title">First, we get to know the job.</h2>
          <p>A job title alone rarely tells the whole story. We ask about the day-to-day work, who the person will work with and what experience really matters.</p>
          <Link className="vp-text-link" to="/employers">How we work with employers <ArrowRight size={15}/></Link><p><Link className="vp-text-link" to="/tools/recruitment-fee-calculator">Calculate your recruitment fee <ArrowRight size={15}/></Link></p><p><Link className="vp-text-link" to="/tools/recruitment-brief-template">Create your recruitment brief <ArrowRight size={15}/></Link></p>
        </div>
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
            ['Engineering & technical','Permanent roles requiring relevant technical knowledge, qualifications and practical experience.','/sectors/engineering'],
            ['HGV & logistics','Permanent Class 1 and Class 2 driver recruitment for transport employers.','/sectors/hgv-driver-recruitment'],
            ['Transport operations','Permanent transport planners, fleet coordinators and logistics staff in Cheshire.','/sectors/transport-logistics-recruitment-cheshire'],
            ['Telesales & inside sales','Permanent telesales executives, appointment setters and inside sales professionals.','/sectors/telesales-recruitment'],
            ['Residential childcare','Permanent residential childcare and senior support worker recruitment for children’s homes in England.','/sectors/childrens-residential-care-recruitment'],
            ['Office & administration','Reliable administrative and operational support, from office staff to experienced coordinators.'],
            ['Accounting & finance','Finance and accounts positions where accuracy, experience and attention to detail count.']
          ].map(([title,copy,route])=><article key={title}><h3>{title}</h3><p>{copy}</p><Link to={route||'/contact'}>{route?'Explore recruitment':'Discuss a role'} <ArrowRight size={15}/></Link></article>)}
        </div>
        <p className="vp-section-note">Based in Greater Manchester, supporting permanent recruitment enquiries across the UK. Every assignment is reviewed individually.</p>
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

      <section className="vp-confidence">
        <div>
          <ShieldCheck size={26}/>
          <p className="vp-kicker">RECRUITMENT WITH ACCOUNTABILITY</p>
          <h2>You decide who gets an interview.</h2>
        </div>
        <div className="vp-confidence-copy">
          <p className="vp-confidence-intro">We review each introduction against your brief, check that candidates are happy for their details to be shared and leave the final hiring decision with you.</p>
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
          <h2 id="vp-discover-title">Looking for your next role?</h2>
          <p>Browse published vacancies and apply directly through Vorlen Careers.</p>
          <Link to="/careers">Browse live opportunities <ArrowRight size={16}/></Link>
        </div>
      </section>

      <section className="vp-faq">
        <div className="vp-faq-head">
          <p className="vp-kicker">COMMON QUESTIONS</p>
          <h2>Questions employers often ask.</h2>
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
      <div className="vp-footer-brand"><VorlenBrand/><p>Good recruitment starts with a conversation.</p><div className="vp-footer-socials" aria-label="Vorlen social media"><a href="https://www.facebook.com/share/19pqmJPH3v/" target="_blank" rel="noopener noreferrer" aria-label="Vorlen on Facebook"><Facebook size={18}/></a><a href="https://www.linkedin.com/company/vorlen/" target="_blank" rel="noopener noreferrer" aria-label="Vorlen on LinkedIn"><Linkedin size={18}/></a><a className="vp-companies-house-link" href="https://find-and-update.company-information.service.gov.uk/company/17387520" target="_blank" rel="noopener noreferrer" aria-label="View Vorlen Ltd on Companies House"><Building2 size={20} aria-hidden="true"/><span>Companies House</span></a></div><DirectoryVerificationBadge/><div className="google-preferred-source"><GooglePreferredSource/></div></div>
      <div><strong>Employers</strong><Link to="/employers">For employers</Link><Link to="/services/permanent-recruitment">Permanent recruitment</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link><Link to="/services/recruitment-for-smes">Recruitment for SMEs</Link></div>
      <div><strong>Candidates</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/candidate-terms">Candidate terms</Link><Link to="/privacy">Privacy policy</Link></div>
      <div><strong>Vorlen</strong><Link to="/about">About us</Link><Link to="/partners">Partner network</Link><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><Link to="/contact">Contact</Link><Link to="/accessibility">Accessibility</Link><Link to="/privacy#cookies">Cookie policy</Link><CookieSettingsLink/></div>
      <div className="vp-footer-base"><span>© {new Date().getFullYear()} Vorlen</span><span>Vorlen Ltd · Company No. 17387520 · Registered in England and Wales · Registered office: Piccadilly Business Centre, Unit C Aldow Enterprise Park, Blackett Street, Manchester, M12 6AE · ICO Ref: ZC275029</span></div>
    </footer>
  </div>
}
