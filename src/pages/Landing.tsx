import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,BriefcaseBusiness,CheckCircle2,Network,ShieldCheck,Users} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import {orgSchema,setSeo} from '../lib/seo';

const faqs=[
  ['What does Vorlen do?','Vorlen is a UK permanent recruitment agency. We work with employers on genuine vacancies, source and assess candidates, coordinate introductions and interviews, and support the process through to placement.'],
  ['Is Vorlen a recruitment agency or recruitment software?','Vorlen is a recruitment business supported by its own technology. Employers and candidates deal with a recruitment team; the platform keeps vacancy, candidate, compliance, interview and placement work connected behind the scenes.'],
  ['How are candidates assessed?','Recruiters review job-related evidence, experience and suitability. Technology and AI may assist with evidence review, but client introductions and recruitment decisions require human oversight.'],
  ['Where does Vorlen recruit?','Vorlen supports permanent recruitment for employers across the United Kingdom.'],
  ['Can recruiters work with Vorlen?','Vorlen operates a selective partner network for experienced recruitment and business-development professionals. Partner access is subject to formal terms, onboarding and approval.']
];

const employerPoints=[
  ['01','Start with the vacancy','We record the role, hiring context and agreed terms before delivery begins.'],
  ['02','Search with intent','Direct sourcing, applications and recruiter-led market work are focused on the actual brief.'],
  ['03','Review properly','Candidate evidence is assessed and introductions require human review and candidate authority.'],
  ['04','Keep momentum','Client feedback, interviews and placement activity remain connected instead of disappearing into email chains.']
];

const paths=[
  {eyebrow:'EMPLOYERS',title:'Need to hire?',copy:'Give us the brief. We will run a structured permanent recruitment search and introduce candidates who have been reviewed against the role.',cta:'Discuss a vacancy',to:'/employers',icon:BriefcaseBusiness},
  {eyebrow:'CANDIDATES',title:'Ready for your next move?',copy:'See live opportunities, understand the role before you apply and keep track of your recruitment activity through Vorlen.',cta:'Explore opportunities',to:'/candidates',icon:Users},
  {eyebrow:'PARTNERS',title:'Build with Vorlen.',copy:'Experienced recruiters can develop UK employer relationships and deliver recruitment through Vorlen under an approved partner agreement.',cta:'Explore partnership',to:'/partners',icon:Network}
];

export default function Landing(){
  useEffect(()=>setSeo({
    title:'Vorlen | UK Permanent Recruitment Agency',
    description:'Vorlen is a UK permanent recruitment agency helping employers hire with structured search, human-reviewed candidate assessment and connected recruitment delivery.',
    path:'/',
    jsonLd:[
      orgSchema(),
      {'@context':'https://schema.org','@type':'Service','@id':'https://www.vorlen.co.uk/#permanent-recruitment',name:'Permanent recruitment services',provider:{'@id':'https://www.vorlen.co.uk/#organization'},areaServed:{'@type':'Country',name:'United Kingdom'},serviceType:'Permanent recruitment',description:'Employer-led permanent recruitment covering vacancy briefing, candidate sourcing, assessment, introduction, interview coordination and placement support.'},
      {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqs.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
    ]
  }),[]);

  return <div className="vorlen-site">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="vorlen-nav">
      <VorlenBrand/>
      <nav aria-label="Primary navigation">
        <a href="#employers">Employers</a>
        <a href="#approach">How we work</a>
        <Link to="/careers">Careers</Link>
        <Link to="/partners">Partners</Link>
      </nav>
      <div className="vorlen-nav-actions">
        <Link className="vorlen-text-link" to="/login">Sign in</Link>
        <Link className="vorlen-button small" to="/contact">Talk to Vorlen <ArrowRight size={15}/></Link>
      </div>
    </header>

    <main id="main">
      <section className="vorlen-hero">
        <div className="vorlen-hero-copy">
          <p className="vorlen-eyebrow">UK PERMANENT RECRUITMENT</p>
          <h1>Hiring should feel <em>decisive.</em></h1>
          <p className="vorlen-hero-lead">Vorlen helps UK employers find, assess and hire people for permanent roles. Clear briefs, focused search, human-reviewed introductions and a recruitment process that keeps moving.</p>
          <div className="vorlen-hero-actions">
            <Link className="vorlen-button" to="/contact">I need to hire <ArrowRight size={17}/></Link>
            <Link className="vorlen-button secondary" to="/careers">I'm looking for a role</Link>
          </div>
          <div className="vorlen-trust-line">
            <span><CheckCircle2 size={15}/> Permanent recruitment</span>
            <span><CheckCircle2 size={15}/> UK employers</span>
            <span><CheckCircle2 size={15}/> Human-reviewed introductions</span>
          </div>
        </div>
        <aside className="vorlen-standard" aria-label="The Vorlen standard">
          <div className="vorlen-standard-top"><span>THE VORLEN STANDARD</span><ShieldCheck size={20}/></div>
          <blockquote>“Technology should make recruitment clearer. It should never replace judgement.”</blockquote>
          <div className="vorlen-standard-list">
            <div><span>01</span><p><strong>Real vacancies first.</strong> Recruitment starts with a genuine employer requirement.</p></div>
            <div><span>02</span><p><strong>Evidence over noise.</strong> Candidate review stays focused on the role.</p></div>
            <div><span>03</span><p><strong>Humans make the call.</strong> Recruiters remain accountable for progression and introductions.</p></div>
          </div>
        </aside>
      </section>

      <section className="vorlen-signal-strip" aria-label="Vorlen recruitment principles">
        <span>BRIEF</span><i/>
        <span>SEARCH</span><i/>
        <span>ASSESS</span><i/>
        <span>INTRODUCE</span><i/>
        <span>INTERVIEW</span><i/>
        <span>PLACE</span>
      </section>

      <section className="vorlen-section vorlen-intro" id="employers">
        <div className="vorlen-section-head">
          <p className="vorlen-eyebrow">FOR EMPLOYERS</p>
          <h2>A recruitment partner that stays close to the work.</h2>
          <p>You should know what is happening with your vacancy without chasing a chain of emails. Vorlen keeps the brief, candidate review, feedback and interview activity connected while recruiters focus on finding the right people.</p>
        </div>
        <div className="vorlen-process">
          {employerPoints.map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}
        </div>
        <div className="vorlen-wide-cta">
          <div><p className="vorlen-eyebrow">HIRING NOW?</p><h3>Tell us who you need.</h3><p>We will start with the vacancy and work backwards from the hire.</p></div>
          <Link className="vorlen-button light" to="/contact">Discuss your vacancy <ArrowRight size={17}/></Link>
        </div>
      </section>

      <section className="vorlen-dark-section" id="approach">
        <div className="vorlen-dark-copy">
          <p className="vorlen-eyebrow light">HOW VORLEN WORKS</p>
          <h2>Structured enough to be reliable. Human enough to be useful.</h2>
          <p>Our technology connects the operational detail — candidate records, screening evidence, client submissions, interviews and placements. The recruitment judgement stays with people.</p>
        </div>
        <div className="vorlen-dark-grid">
          <article><strong>01</strong><h3>Commercial clarity</h3><p>Client terms and the vacancy are recorded before candidate introductions begin.</p></article>
          <article><strong>02</strong><h3>Candidate control</h3><p>Candidate information is handled through defined recruitment and privacy processes.</p></article>
          <article><strong>03</strong><h3>Review before introduction</h3><p>Suitability evidence and candidate willingness are recorded before a profile goes to a client.</p></article>
          <article><strong>04</strong><h3>One connected process</h3><p>Feedback, interviews and placement outcomes remain attached to the work that produced them.</p></article>
        </div>
      </section>

      <section className="vorlen-section vorlen-audiences">
        <div className="vorlen-section-head compact">
          <p className="vorlen-eyebrow">WORK WITH VORLEN</p>
          <h2>One brand. Three ways in.</h2>
        </div>
        <div className="vorlen-path-grid">
          {paths.map(({eyebrow,title,copy,cta,to,icon:Icon})=><article key={eyebrow}>
            <div className="vorlen-path-icon"><Icon size={20}/></div>
            <p className="vorlen-eyebrow">{eyebrow}</p>
            <h3>{title}</h3>
            <p>{copy}</p>
            <Link to={to}>{cta} <ArrowRight size={15}/></Link>
          </article>)}
        </div>
      </section>

      <section className="vorlen-partner-section" id="partners">
        <div>
          <p className="vorlen-eyebrow light">VORLEN PARTNER NETWORK</p>
          <h2>Experienced recruiters. Independent drive. Vorlen behind the operation.</h2>
        </div>
        <div className="vorlen-partner-copy">
          <p>Selected partners can develop UK clients, bring genuine vacancies into Vorlen, source candidates and progress recruitment activity through the platform. The model is performance based and governed by formal partner terms.</p>
          <Link className="vorlen-button light" to="/contact">Talk about partnership <ArrowRight size={16}/></Link>
        </div>
      </section>

      <section className="vorlen-section vorlen-faq">
        <div className="vorlen-section-head compact"><p className="vorlen-eyebrow">QUESTIONS</p><h2>What people usually want to know.</h2></div>
        <div className="vorlen-faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div>
      </section>
    </main>

    <footer className="vorlen-footer">
      <div className="vorlen-footer-brand"><VorlenBrand/><p>Permanent recruitment, properly run.</p></div>
      <div><strong>For employers</strong><Link to="/employers">For employers</Link><Link to="/services/permanent-recruitment">Permanent recruitment</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link></div>
      <div><strong>For candidates</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/candidate-terms">Candidate terms</Link></div>
      <div><strong>Vorlen</strong><Link to="/partners">Partner network</Link><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><a href="mailto:contact@vorlen.co.uk">contact@vorlen.co.uk</a></div>
      <div className="vorlen-footer-bottom"><span>© {new Date().getFullYear()} Vorlen</span><span>United Kingdom</span></div>
    </footer>
  </div>
}