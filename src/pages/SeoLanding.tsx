import {useEffect} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowRight,BriefcaseBusiness,CheckCircle2,MapPin,Network,Search,ShieldCheck,Users} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import {setSeo} from '../lib/seo';

type PageConfig={
  eyebrow:string; title:string; accent:string; intro:string; audience:string;
  points:[string,string][]; sections:{title:string;copy:string}[];
  faq:[string,string][]; ctaTitle:string; ctaCopy:string; ctaLabel:string; ctaTo:string;
  serviceType?:string; area?:string;
};

const pages:Record<string,PageConfig>={
  '/employers':{
    eyebrow:'FOR EMPLOYERS',title:'Permanent recruitment that stays close to the',accent:'hire.',
    intro:'Vorlen helps UK employers turn a genuine vacancy into a structured search, human-reviewed candidate introductions and a recruitment process that keeps moving.',
    audience:'For employers who want a recruitment partner that understands the brief, communicates clearly and stays accountable through sourcing, review, interview and placement.',
    points:[['Start with a real brief','We begin with the role, hiring context and agreed terms so the search is grounded in what the employer actually needs.'],['Search with intent','Direct sourcing, applications and recruiter-led market work focus on the role rather than generating volume for its own sake.'],['Review before introduction','Candidate evidence is reviewed by people before an introduction is made.'],['Keep momentum visible','Feedback, interviews and placement activity remain connected to the vacancy instead of disappearing into separate email chains.']],
    sections:[{title:'A clearer employer experience',copy:'Vorlen combines recruiter judgement with a connected operating system so vacancy details, candidate evidence, feedback and interview activity stay attached to the same piece of work.'},{title:'Built for permanent hiring',copy:'The service is designed around permanent recruitment: understand the vacancy, find relevant people, assess job-related evidence, introduce with context and support the process through to placement.'}],
    faq:[['What kind of recruitment does Vorlen provide?','Vorlen focuses on permanent recruitment for UK employers.'],['Does Vorlen send CVs without reviewing candidates?','No. Candidate introductions require human review and candidate authority before identifiable information is shared with a client.'],['Can we discuss a role before formally engaging?','Yes. The first step can be a straightforward conversation about the vacancy, hiring context and the support you need.']],
    ctaTitle:'Hiring for a permanent role?',ctaCopy:'Tell us who you need and what success looks like in the role.',ctaLabel:'Discuss a vacancy',ctaTo:'/contact',serviceType:'Permanent recruitment',area:'United Kingdom'
  },
  '/candidates':{
    eyebrow:'FOR CANDIDATES',title:'A recruitment process you can',accent:'understand.',
    intro:'Explore live opportunities, see what a role involves before you apply and keep your application and interview activity connected through Vorlen.',
    audience:'For candidates looking for permanent opportunities and a recruitment process with clear role information, human review and straightforward communication.',
    points:[['See the opportunity clearly','Published roles show the information available about the role, location, type and application route.'],['Apply securely','Applications and CVs are submitted through Vorlen rather than being passed around informally.'],['Human review matters','Technology may assist evidence review, but people remain responsible for recruitment progression and introductions.'],['Keep track of activity','Private candidate links can bring application and interview information together in one place.']],
    sections:[{title:'Opportunities, not noise',copy:'Vorlen Careers is built around current published opportunities. Where a page is for registering interest rather than a confirmed live client vacancy, it is labelled accordingly.'},{title:'Your information stays part of the process',copy:'Candidate information is handled through defined recruitment, privacy and work-seeker processes. You can also use the candidate portal to make data-rights requests where available.'}],
    faq:[['Do I need an account to browse jobs?','No. You can browse published opportunities through Vorlen Careers without creating an account.'],['Does AI decide whether I get a job?','No. AI may assist with job-related evidence review, but recruitment progression and client introductions require human oversight.'],['Where can I see current vacancies?','Published opportunities are available on the Vorlen Careers page.']],
    ctaTitle:'Looking for your next move?',ctaCopy:'Browse current opportunities and read the details before you apply.',ctaLabel:'Explore opportunities',ctaTo:'/careers',serviceType:'Candidate recruitment services',area:'United Kingdom'
  },
  '/services/permanent-recruitment':{
    eyebrow:'PERMANENT RECRUITMENT',title:'A focused search from brief to',accent:'placement.',
    intro:'Vorlen provides permanent recruitment for UK employers, connecting vacancy briefing, candidate sourcing, job-related assessment, introductions, interviews and placement support.',
    audience:'For employers who need a recruitment partner to run a defined permanent search rather than simply forward CVs.',
    points:[['Brief','Capture the role, hiring context, requirements and agreed commercial terms.'],['Search','Use direct sourcing, applications and recruiter-led market work to find relevant people.'],['Assess','Review job-related evidence, experience and suitability with human oversight.'],['Progress','Coordinate introductions, client feedback, interviews and placement activity.']],
    sections:[{title:'The vacancy stays central',copy:'Permanent recruitment works best when every activity can be traced back to the role being hired. Vorlen keeps the brief, candidate review and client feedback connected.'},{title:'Technology supports the work',copy:'The platform helps organise the process and preserve evidence. Recruiters remain responsible for judgement, candidate progression and client introductions.'}],
    faq:[['What is permanent recruitment?','Permanent recruitment is a work-finding service focused on hiring candidates into ongoing employee roles rather than supplying temporary workers.'],['What stages can Vorlen support?','Vacancy briefing, candidate sourcing, job-related assessment, introductions, interview coordination and placement support.'],['Does Vorlen work across the UK?','Yes. Vorlen supports permanent recruitment for employers across the United Kingdom.']],
    ctaTitle:'Have a permanent vacancy?',ctaCopy:'Start with the brief and we can work backwards from the hire.',ctaLabel:'Talk to Vorlen',ctaTo:'/contact',serviceType:'Permanent recruitment',area:'United Kingdom'
  },
  '/services/candidate-sourcing':{
    eyebrow:'CANDIDATE SOURCING',title:'Find relevant people, then review them',accent:'properly.',
    intro:'Candidate sourcing at Vorlen is tied to a defined vacancy. The aim is not maximum CV volume; it is a relevant search followed by human-reviewed assessment.',
    audience:'For employers that need proactive search and candidate discovery alongside inbound applications.',
    points:[['Define the search','Use the vacancy, required experience and practical hiring context to shape sourcing.'],['Reach beyond applicants','Direct sourcing can identify people who may not already be applying through public job boards.'],['Keep evidence attached','Candidate information and recruiter notes remain linked to the vacancy and recruitment activity.'],['Introduce with context','Client introductions are made after human review and candidate authority.']],
    sections:[{title:'Sourcing is only useful when the brief is clear',copy:'A larger list is not automatically a better shortlist. Vorlen keeps sourcing criteria tied to the employer requirement and the evidence available from each candidate.'},{title:'Human review before client submission',copy:'Technology can help organise information and surface evidence, but recruiters remain accountable for deciding whether a candidate should progress to introduction.'}],
    faq:[['Is candidate sourcing the same as posting a job advert?','No. Advertising attracts applicants; sourcing can also involve proactive search for potentially relevant people.'],['Will every sourced candidate be sent to the client?','No. Sourcing creates a pool to review. Client introductions require further assessment and candidate authority.'],['Can sourcing support hard-to-fill roles?','It can broaden the search beyond active applicants, although results depend on the role, market and employer requirements.']],
    ctaTitle:'Need a more focused search?',ctaCopy:'Share the role and hiring context so we can define the sourcing approach.',ctaLabel:'Discuss candidate sourcing',ctaTo:'/contact',serviceType:'Candidate sourcing',area:'United Kingdom'
  },
  '/services/recruitment-for-smes':{
    eyebrow:'RECRUITMENT FOR SMEs',title:'Hiring support without building a recruitment',accent:'machine.',
    intro:'Vorlen supports UK small and medium-sized employers that need permanent hires but do not necessarily have a large internal talent-acquisition function.',
    audience:'For SMEs that want a clear external recruitment process around a genuine vacancy, with structured search and straightforward communication.',
    points:[['One clear point of work','Keep the vacancy, candidate review, feedback and interview activity connected.'],['Flexible recruiter support','Use external recruitment capacity when you need to hire rather than carrying a full internal recruitment operation.'],['Human-reviewed introductions','Receive candidate context rather than an unfiltered stream of CVs.'],['Commercial clarity','Agree the recruitment terms and vacancy context before introductions begin.']],
    sections:[{title:'Designed around the actual hire',copy:'Smaller employers often need recruitment support that is practical rather than process-heavy. Vorlen keeps the structure needed for good recruitment while focusing on the vacancy in front of you.'},{title:'Useful visibility without extra admin',copy:'A connected recruitment workspace helps keep feedback, interviews and candidate activity organised so employers do not have to reconstruct the process from inbox threads.'}],
    faq:[['Does Vorlen only work with large companies?','No. Vorlen can support small and medium-sized UK employers as well as larger organisations.'],['Can an SME use Vorlen for one vacancy?','The service can begin with a specific permanent vacancy and the support required for that search.'],['Do we need our own ATS?','No. Vorlen uses its own recruitment technology to support delivery; employers do not need to run the underlying system themselves.']],
    ctaTitle:'Hiring without a big internal recruitment team?',ctaCopy:'Tell us about the vacancy and the level of support you need.',ctaLabel:'Discuss SME recruitment',ctaTo:'/contact',serviceType:'Recruitment for small and medium-sized businesses',area:'United Kingdom'
  },
  '/partners':{
    eyebrow:'VORLEN PARTNER NETWORK',title:'Experienced recruiters. Independent drive. One',accent:'operation.',
    intro:'Vorlen operates a selective partner network for experienced recruitment and business-development professionals working under formal terms, onboarding and approval.',
    audience:'For experienced recruitment professionals who can develop genuine employer relationships, work vacancies and progress recruitment activity within the Vorlen operating model.',
    points:[['Bring genuine client work','Partner activity is built around real employer relationships and genuine recruitment requirements.'],['Work inside one system','Client, vacancy, candidate and commercial activity remain connected to the same operating environment.'],['Follow defined controls','Partner access is subject to formal terms, approval, compliance requirements and role-based permissions.'],['Focus on outcomes','The model is performance-oriented, with recruitment work tracked through to client and placement outcomes.']],
    sections:[{title:'A network, not a free-for-all',copy:'Vorlen is selective about partner access because client relationships, candidate information and recruitment decisions need clear ownership and controls.'},{title:'Technology behind the operation',copy:'The platform supports candidate sourcing, client activity, vacancies, interviews and commercial tracking so approved partners can work inside the same delivery framework.'}],
    faq:[['Who is the partner network for?','It is intended for experienced recruitment and business-development professionals who can operate within Vorlen terms and controls.'],['Is partner access automatic?','No. Partner access is subject to discussion, formal terms, onboarding and approval.'],['Can partners access all candidate or client data?','No. Access is controlled according to role, workspace permissions and the recruitment activity the partner is authorised to work on.']],
    ctaTitle:'Interested in working with Vorlen?',ctaCopy:'Start with your recruitment background and the kind of employer relationships you work with.',ctaLabel:'Discuss partnership',ctaTo:'/contact',serviceType:'Recruitment partner network',area:'United Kingdom'
  },
  '/locations/manchester':{
    eyebrow:'MANCHESTER RECRUITMENT',title:'Permanent recruitment support for Manchester',accent:'employers.',
    intro:'Vorlen supports employers hiring for permanent roles in Manchester, combining focused search, human-reviewed candidate assessment and connected recruitment delivery.',
    audience:'For Manchester employers that need external recruitment support around a genuine permanent vacancy.',
    points:[['Manchester hiring brief','Start with the role, workplace context, location expectations and the experience required.'],['Search beyond one channel','Combine applications with proactive sourcing where appropriate.'],['Human-reviewed shortlist','Review candidate evidence before any client introduction.'],['Connected progression','Keep feedback, interviews and placement activity attached to the vacancy.']],
    sections:[{title:'Recruitment shaped around the role and location',copy:'Location matters in permanent recruitment. Commute expectations, on-site requirements, hybrid patterns and the local candidate market can all affect the search, so these belong in the brief from the start.'},{title:'Manchester within a UK-wide search capability',copy:'Vorlen can support Manchester hiring while also searching more broadly across the UK when the role and employer requirements justify it.'}],
    faq:[['Does Vorlen recruit in Manchester?','Yes. Vorlen supports permanent recruitment for employers in Manchester and across the wider United Kingdom.'],['Can you recruit for hybrid Manchester roles?','Hybrid and on-site expectations can be built into the vacancy brief and sourcing criteria.'],['Do you only search within Manchester?','No. The search can be local or broader depending on the role, commute requirements and employer brief.']],
    ctaTitle:'Hiring in Manchester?',ctaCopy:'Share the vacancy, location requirements and the kind of person you need.',ctaLabel:'Discuss a Manchester vacancy',ctaTo:'/contact',serviceType:'Permanent recruitment in Manchester',area:'Manchester, United Kingdom'
  },
  '/locations/greater-manchester':{
    eyebrow:'GREATER MANCHESTER RECRUITMENT',title:'Permanent recruitment across Greater',accent:'Manchester.',
    intro:'Vorlen supports employers across Greater Manchester with permanent recruitment built around clear briefs, focused sourcing and human-reviewed candidate introductions.',
    audience:'For employers across Greater Manchester that need structured external recruitment support for permanent roles.',
    points:[['Define the local requirement','Capture workplace location, commute expectations, working pattern and the practical requirements of the role.'],['Search intelligently','Use direct sourcing and applications in line with the vacancy rather than limiting the search to one channel.'],['Review job-related evidence','Assess experience and suitability with people accountable for progression decisions.'],['Coordinate the process','Keep client feedback, interviews and placement activity connected from brief to outcome.']],
    sections:[{title:'Greater Manchester is not one hiring market',copy:'Travel patterns, sector clusters, on-site expectations and candidate availability can vary across the region. The recruitment brief should reflect the actual workplace and role rather than treating the whole area as interchangeable.'},{title:'Local context, wider reach',copy:'A Greater Manchester vacancy can still benefit from a broader UK search when relocation, hybrid working or specialist experience makes that appropriate.'}],
    faq:[['Which Greater Manchester areas can Vorlen support?','Vorlen can support employers across Greater Manchester, with the exact search shaped by the workplace location and vacancy requirements.'],['Can sourcing extend outside Greater Manchester?','Yes. Search geography can be widened where the employer brief and role make that useful.'],['Is Vorlen a temporary staffing agency?','Vorlen is positioned around permanent recruitment rather than temporary-worker supply.']],
    ctaTitle:'Recruiting across Greater Manchester?',ctaCopy:'Tell us the workplace, role and hiring context so we can shape the search.',ctaLabel:'Discuss your vacancy',ctaTo:'/contact',serviceType:'Permanent recruitment in Greater Manchester',area:'Greater Manchester, United Kingdom'
  }
};

const iconFor=(path:string)=>path.includes('candidate')?Users:path.includes('partner')?Network:path.includes('location')?MapPin:path.includes('sourcing')?Search:BriefcaseBusiness;

export default function SeoLanding(){
  const {pathname}=useLocation();
  const page=pages[pathname]||pages['/employers'];
  const Icon=iconFor(pathname);
  const title=`${page.eyebrow.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())} | Vorlen`;
  useEffect(()=>{
    const service={'@context':'https://schema.org','@type':'Service',name:page.serviceType||page.eyebrow,serviceType:page.serviceType||page.eyebrow,provider:{'@id':'https://www.vorlen.co.uk/#organization'},areaServed:{'@type':'AdministrativeArea',name:page.area||'United Kingdom'},url:`https://www.vorlen.co.uk${pathname}`,description:page.intro};
    const faq={'@context':'https://schema.org','@type':'FAQPage',mainEntity:page.faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))};
    const crumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Vorlen',item:'https://www.vorlen.co.uk/'},{'@type':'ListItem',position:2,name:page.eyebrow,item:`https://www.vorlen.co.uk${pathname}`}]};
    setSeo({title,description:page.intro,path:pathname,jsonLd:[service,faq,crumbs]});
  },[pathname,page,title]);

  return <div className="vorlen-site vorlen-seo-page">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="vorlen-nav">
      <VorlenBrand/>
      <nav aria-label="Primary navigation">
        <Link to="/employers">Employers</Link>
        <Link to="/services/permanent-recruitment">Services</Link>
        <Link to="/careers">Careers</Link>
        <Link to="/partners">Partners</Link>
      </nav>
      <div className="vorlen-nav-actions"><Link className="vorlen-text-link" to="/login">Sign in</Link><Link className="vorlen-button small" to="/contact">Talk to Vorlen <ArrowRight size={15}/></Link></div>
    </header>
    <main id="main">
      <section className="seo-hero">
        <div>
          <p className="vorlen-eyebrow">{page.eyebrow}</p>
          <h1>{page.title} <em>{page.accent}</em></h1>
          <p>{page.intro}</p>
          <div className="vorlen-hero-actions"><Link className="vorlen-button" to={page.ctaTo}>{page.ctaLabel} <ArrowRight size={16}/></Link><Link className="vorlen-button secondary" to="/careers">View opportunities</Link></div>
        </div>
        <aside className="seo-audience-card"><Icon size={24}/><span>WHO THIS IS FOR</span><p>{page.audience}</p><div><CheckCircle2 size={16}/> Human-reviewed recruitment</div><div><ShieldCheck size={16}/> Clear recruitment controls</div></aside>
      </section>

      <section className="seo-points">
        {page.points.map(([heading,copy],i)=><article key={heading}><span>0{i+1}</span><h2>{heading}</h2><p>{copy}</p></article>)}
      </section>

      <section className="seo-copy-grid">
        {page.sections.map((section,i)=><article key={section.title}><p className="vorlen-eyebrow">{i===0?'HOW VORLEN WORKS':'WHY IT MATTERS'}</p><h2>{section.title}</h2><p>{section.copy}</p></article>)}
      </section>

      <section className="seo-related">
        <p className="vorlen-eyebrow">EXPLORE VORLEN</p>
        <div>
          <Link to="/services/permanent-recruitment">Permanent recruitment <ArrowRight size={14}/></Link>
          <Link to="/services/candidate-sourcing">Candidate sourcing <ArrowRight size={14}/></Link>
          <Link to="/services/recruitment-for-smes">Recruitment for SMEs <ArrowRight size={14}/></Link>
          <Link to="/locations/manchester">Manchester recruitment <ArrowRight size={14}/></Link>
          <Link to="/locations/greater-manchester">Greater Manchester <ArrowRight size={14}/></Link>
        </div>
      </section>

      <section className="vorlen-section vorlen-faq seo-faq-page">
        <div className="vorlen-section-head compact"><p className="vorlen-eyebrow">COMMON QUESTIONS</p><h2>Useful answers before you start.</h2></div>
        <div className="vorlen-faq-list">{page.faq.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div>
      </section>

      <section className="seo-final-cta"><div><p className="vorlen-eyebrow light">START WITH THE BRIEF</p><h2>{page.ctaTitle}</h2><p>{page.ctaCopy}</p></div><Link className="vorlen-button light" to={page.ctaTo}>{page.ctaLabel} <ArrowRight size={16}/></Link></section>
    </main>
    <footer className="vorlen-footer">
      <div className="vorlen-footer-brand"><VorlenBrand/><p>Permanent recruitment, properly run.</p></div>
      <div><strong>Employers</strong><Link to="/employers">Employer recruitment</Link><Link to="/services/permanent-recruitment">Permanent recruitment</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link><Link to="/services/recruitment-for-smes">Recruitment for SMEs</Link></div>
      <div><strong>Candidates & partners</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/partners">Partner network</Link></div>
      <div><strong>Locations</strong><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><Link to="/contact">Contact Vorlen</Link></div>
      <div className="vorlen-footer-bottom"><span>© {new Date().getFullYear()} Vorlen</span><span>Ivy and Pearls Ltd trading as Vorlen · Company No. 17387520 · Registered in England and Wales · Registered office: 10 South Street, Rochdale, United Kingdom, OL16 2EP</span></div>
    </footer>
  </div>
}
