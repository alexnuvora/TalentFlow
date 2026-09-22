import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ArrowUpRight,Check,ChevronDown} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import {orgSchema,setSeo} from '../lib/seo';

const faqs=[
  ['What does Vorlen do?','Vorlen is a UK permanent recruitment agency. We work with employers on genuine vacancies, source and assess candidates, coordinate introductions and interviews, and support the process through to placement.'],
  ['Is Vorlen a recruitment agency or recruitment software?','Vorlen is a recruitment business supported by its own technology. Employers and candidates deal with a recruitment team; the platform keeps vacancy, candidate, compliance, interview and placement work connected behind the scenes.'],
  ['How are candidates assessed?','Recruiters review job-related evidence, experience and suitability. Technology and AI may assist with evidence review, but client introductions and recruitment decisions require human oversight.'],
  ['Where does Vorlen recruit?','Vorlen supports permanent recruitment for employers across the United Kingdom.'],
  ['Can recruiters work with Vorlen?','Vorlen operates a selective partner network for experienced recruitment and business-development professionals. Partner access is subject to formal terms, onboarding and approval.']
];

const method=[
  ['01','Brief','Get precise about the role before the search begins.','Vacancy context, requirements and agreed terms are recorded first.'],
  ['02','Search','Go looking for relevance, not volume.','Direct sourcing and applications are worked against the actual brief.'],
  ['03','Assess','Turn candidate information into useful evidence.','Recruiters review job-related experience and suitability before progression.'],
  ['04','Introduce','Send context, not a pile of CVs.','Candidate authority and human review come before a client introduction.'],
  ['05','Progress','Keep the hiring process moving.','Feedback, interviews and outcomes stay connected to the vacancy.']
];

export default function Landing(){
  useEffect(()=>setSeo({
    title:'Vorlen | UK Permanent Recruitment Agency',
    description:'Vorlen is a UK permanent recruitment agency helping employers hire with focused search, human-reviewed candidate assessment and connected recruitment delivery.',
    path:'/',
    jsonLd:[
      orgSchema(),
      {'@context':'https://schema.org','@type':'Service','@id':'https://www.vorlen.co.uk/#permanent-recruitment',name:'Permanent recruitment services',provider:{'@id':'https://www.vorlen.co.uk/#organization'},areaServed:{'@type':'Country',name:'United Kingdom'},serviceType:'Permanent recruitment',description:'Employer-led permanent recruitment covering vacancy briefing, candidate sourcing, assessment, introduction, interview coordination and placement support.'},
      {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqs.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
    ]
  }),[]);

  return <div className="vl-home">
    <a className="skip-link" href="#main">Skip to content</a>

    <header className="vl-nav">
      <VorlenBrand/>
      <nav aria-label="Primary navigation">
        <Link to="/employers">Employers</Link>
        <Link to="/services/permanent-recruitment">Services</Link>
        <Link to="/careers">Careers</Link>
        <Link to="/partners">Partners</Link>
      </nav>
      <div className="vl-nav-actions">
        <Link className="vl-signin" to="/login">Sign in</Link>
        <Link className="vl-nav-cta" to="/contact">Start a search <ArrowUpRight size={15}/></Link>
      </div>
    </header>

    <main id="main">
      <section className="vl-hero">
        <div className="vl-hero-index" aria-hidden="true">
          <span>V / 01</span>
          <span>UK — 2026</span>
        </div>

        <div className="vl-hero-main">
          <p className="vl-kicker"><span/> Permanent recruitment / United Kingdom</p>
          <h1>Find the person.<br/><i>Move with certainty.</i></h1>
          <div className="vl-hero-bottom">
            <p>Vorlen runs focused permanent recruitment searches for UK employers — from a clear brief to human-reviewed introductions, interviews and placement.</p>
            <div className="vl-hero-actions">
              <Link className="vl-primary" to="/contact">I need to hire <ArrowRight size={17}/></Link>
              <Link className="vl-secondary" to="/careers">Explore opportunities</Link>
            </div>
          </div>
        </div>

        <aside className="vl-hero-ledger" aria-label="Vorlen recruitment process">
          <div className="vl-ledger-head"><span>SEARCH PROTOCOL</span><span>01—05</span></div>
          {['Brief the role','Search the market','Review evidence','Introduce with context','Progress the hire'].map((item,i)=>
            <div className="vl-ledger-row" key={item}><span>0{i+1}</span><strong>{item}</strong>{i<4&&<i/>}</div>
          )}
          <div className="vl-ledger-note"><Check size={15}/><span>Human review remains accountable for candidate progression and introductions.</span></div>
        </aside>
      </section>

      <section className="vl-statement">
        <p className="vl-kicker">THE PROBLEM WE REMOVE</p>
        <h2>Recruitment gets noisy when the brief, search, candidate evidence and client feedback live in different places.</h2>
        <p className="vl-statement-copy">Vorlen keeps the work connected. Recruiters can spend more time judging fit and moving the process forward — while employers get a clearer view of what is actually happening with the vacancy.</p>
      </section>

      <section className="vl-method" id="approach">
        <div className="vl-method-intro">
          <p className="vl-kicker">HOW THE WORK MOVES</p>
          <h2>One search.<br/>Five disciplined moves.</h2>
          <p>Technology organises the operating detail. People remain responsible for the recruitment judgement.</p>
          <Link to="/services/permanent-recruitment">See permanent recruitment <ArrowRight size={14}/></Link>
        </div>
        <div className="vl-method-list">
          {method.map(([n,title,lead,copy])=><article key={n}>
            <span className="vl-method-number">{n}</span>
            <div><h3>{title}</h3><strong>{lead}</strong><p>{copy}</p></div>
            <ArrowUpRight className="vl-method-arrow" size={19}/>
          </article>)}
        </div>
      </section>

      <section className="vl-choice" aria-label="Ways to work with Vorlen">
        <div className="vl-choice-employer">
          <span>FOR EMPLOYERS</span>
          <h2>There is a role to fill.</h2>
          <p>Bring us the vacancy. We will shape the search around the actual requirement and keep you close to candidate review and progression.</p>
          <Link to="/employers">Recruit with Vorlen <ArrowRight size={16}/></Link>
        </div>
        <div className="vl-choice-candidate">
          <span>FOR CANDIDATES</span>
          <h2>There is a move to make.</h2>
          <p>Explore published opportunities, understand the role before applying and keep your recruitment activity connected through Vorlen.</p>
          <Link to="/careers">View current opportunities <ArrowRight size={16}/></Link>
        </div>
      </section>

      <section className="vl-principles">
        <div className="vl-principles-title">
          <p className="vl-kicker">THE VORLEN STANDARD</p>
          <h2>What we will not optimise away.</h2>
        </div>
        <div className="vl-principles-list">
          <div><span>01</span><strong>Real vacancies first.</strong><p>The search begins with a genuine employer requirement and a defined role.</p></div>
          <div><span>02</span><strong>Evidence over volume.</strong><p>More CVs is not the objective. Useful, role-relevant evidence is.</p></div>
          <div><span>03</span><strong>Human judgement stays in the loop.</strong><p>Technology may assist the work; people remain accountable for progression and introductions.</p></div>
        </div>
      </section>

      <section className="vl-partner">
        <div className="vl-partner-number">03</div>
        <div>
          <p className="vl-kicker light">VORLEN PARTNER NETWORK</p>
          <h2>Recruit independently.<br/>Operate as one team.</h2>
        </div>
        <div className="vl-partner-copy">
          <p>Experienced recruiters and business-development professionals can work through Vorlen under formal partner terms, shared operating controls and one connected recruitment system.</p>
          <Link to="/partners">Explore the partner network <ArrowRight size={16}/></Link>
        </div>
      </section>

      <section className="vl-faq">
        <div className="vl-faq-title">
          <p className="vl-kicker">QUESTIONS / ANSWERS</p>
          <h2>The useful things to know first.</h2>
        </div>
        <div className="vl-faq-list">
          {faqs.map(([q,a],i)=><details key={q}>
            <summary><span>0{i+1}</span><strong>{q}</strong><ChevronDown size={18}/></summary>
            <p>{a}</p>
          </details>)}
        </div>
      </section>

      <section className="vl-close">
        <p className="vl-kicker light">START WITH THE VACANCY</p>
        <h2>If the hire matters,<br/><i>make the search deliberate.</i></h2>
        <Link className="vl-close-cta" to="/contact">Discuss a vacancy <ArrowUpRight size={18}/></Link>
      </section>
    </main>

    <footer className="vl-footer">
      <div className="vl-footer-brand"><VorlenBrand/><p>Permanent recruitment, properly run.</p></div>
      <div><strong>Employers</strong><Link to="/employers">For employers</Link><Link to="/services/permanent-recruitment">Permanent recruitment</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link></div>
      <div><strong>Candidates</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/candidate-terms">Candidate terms</Link></div>
      <div><strong>Vorlen</strong><Link to="/partners">Partner network</Link><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><Link to="/contact">Contact</Link></div>
      <div className="vl-footer-base"><span>© {new Date().getFullYear()} Vorlen</span><span>VORLEN T/A IVY AND PEARLS LTD · Company No. 17387520</span></div>
    </footer>
  </div>
}
