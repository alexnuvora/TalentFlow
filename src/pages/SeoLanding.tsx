import {useEffect} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowRight,BriefcaseBusiness,CheckCircle2,MapPin,Network,Search,ShieldCheck,Users} from 'lucide-react';
import VorlenBrand from '../components/VorlenBrand';
import GooglePreferredSource from '../components/GooglePreferredSource';
import {setSeo} from '../lib/seo';

type PageConfig={
  eyebrow:string; title:string; accent:string; intro:string; audience:string;
  points:[string,string][]; sections:{title:string;copy:string}[];
  faq:[string,string][]; ctaTitle:string; ctaCopy:string; ctaLabel:string; ctaTo:string;
  serviceType?:string; area?:string;
};

const pages:Record<string,PageConfig>={
  '/employers':{
    eyebrow:'FOR EMPLOYERS',title:'Recruitment that answers',accent:'the brief.',
    intro:'Tell us the role, salary and must-haves. Our standard permanent placement fee is 15% of agreed first-year salary, subject to written terms. We confirm the fee and payment terms before sourcing, review candidates ourselves and explain why each introduction fits.',
    audience:'For employers who want a shortlist with reasoning behind it, not a pile of CVs.',
    points:[['Start with a real brief','The role, the salary, the working pattern, and the two or three skills that actually decide whether someone can do the job.'],['Search with intent','We go out and find people, including the ones not actively applying anywhere.'],['Review before introduction','A recruiter reads the evidence before you see anyone. No forwarding blind.'],['Keep momentum','Feedback, interviews and offers stay attached to the vacancy instead of scattered across inbox threads.']],
    sections:[{title:'You see the reasoning, not just the CV',copy:'Every introduction comes with why this person, what evidence supports it, and what to probe in the interview. That is the difference between a shortlist and a pile of paper.'},{title:'Built for permanent hiring',copy:'This is all Vorlen does: permanent roles, brief to placement. Sourcing, screening, introductions, interview coordination, offer support.'}],
    faq:[['What kind of recruitment does Vorlen provide?','Permanent recruitment for UK employers. Not temp staffing, not recruitment software you have to run yourself.'],['Does Vorlen send CVs without reviewing candidates?','No. A person reads the evidence and candidate details go out with the recruiter\'s reasoning and the candidate\'s authority.'],['Can we talk before formally engaging?','Yes. The first conversation costs nothing: tell us the role and we\'ll say whether we can help and what it would cost.']],
    ctaTitle:'Hiring for a permanent role?',ctaCopy:'Tell us who you need and what success looks like in the role.',ctaLabel:'Discuss a vacancy',ctaTo:'/contact',serviceType:'Permanent recruitment',area:'United Kingdom'
  },
  '/candidates':{
    eyebrow:'FOR CANDIDATES',title:'A recruitment process you can',accent:'understand.',
    intro:'Browse published roles, read what the job actually involves, and apply online. No account needed to look.',
    audience:'For candidates who want clear job details, a secure application, and a person at the other end.',
    points:[['See the opportunity clearly','Published roles show the role, location, type and application route, plainly.'],['Apply securely','Applications and CVs go through Vorlen, not passed around informally.'],['A person reads it','Your application goes to a recruiter, not a queue. Tech can help organise evidence; a person decides what happens next.'],['Keep track','Private candidate links bring your applications and interview activity together in one place.']],
    sections:[{title:'Opportunities, not noise',copy:'Vorlen Careers lists current published opportunities. Where a page is for registering interest rather than a confirmed live vacancy, it says so — you always know which kind you\'re looking at.'},{title:'Your information, handled properly',copy:'Candidate information runs through defined recruitment, privacy and work-seeker processes. The candidate portal lets you make data-rights requests where available.'}],
    faq:[['Do I need an account to browse jobs?','No. Browse everything on Vorlen Careers without creating an account.'],['Does AI decide whether I get a job?','No. Tech can help organise evidence, but a person decides what happens next with your application.'],['Where can I see current vacancies?','On the Vorlen Careers page.']],
    ctaTitle:'Looking for your next move?',ctaCopy:'Read the details properly before you apply. That\'s what they\'re there for.',ctaLabel:'Explore opportunities',ctaTo:'/careers',serviceType:'Candidate recruitment services',area:'United Kingdom'
  },
  '/services/permanent-recruitment':{
    eyebrow:'PERMANENT RECRUITMENT',title:'A focused search from brief to',accent:'placement.',
    intro:'Permanent recruitment, brief to placement: sourcing, screening, introductions with reasoning, and interview coordination through to offer.',
    audience:'For employers who need the right person, not a pile of CVs.',
    points:[['Brief','The role, the salary, the working pattern, the must-haves — agreed in writing before the search starts, fee included.'],['Search','Direct sourcing plus relevant applications. We go looking, including at people who aren\'t actively applying.'],['Assess','A recruiter reads the evidence against your brief before anyone is introduced.'],['Progress','Introductions, client feedback, interviews and offers, kept in one place.']],
    sections:[{title:'The vacancy stays central',copy:'Every activity traces back to the role being hired: the brief, the review, the feedback. Nothing drifts into a separate inbox thread nobody can find later.'},{title:'Technology supports the work',copy:'The platform organises the process and preserves evidence. A recruiter makes the judgement calls — who to introduce, what to probe, when to push back.'}],
    faq:[['What is permanent recruitment?','Work-finding focused on hiring candidates into ongoing employee roles — not supplying temporary workers.'],['What stages does Vorlen cover?','Brief, sourcing, assessment, introductions, interview coordination and placement support.'],['Does Vorlen work across the UK?','Yes, from our Manchester base.']],
    ctaTitle:'Have a permanent vacancy?',ctaCopy:'Start with the brief. We\'ll work backwards from the hire.',ctaLabel:'Talk to Vorlen',ctaTo:'/contact',serviceType:'Permanent recruitment',area:'United Kingdom'
  },
  '/guides/choosing-a-recruitment-agency':{
    eyebrow:'EMPLOYER GUIDE',title:'Choosing a recruitment agency: fees, shortlists and the questions worth',accent:'asking.',
    intro:'A practical guide to picking a UK recruitment agency — what fees should look like, what to ask about screening, and the answers that separate good agencies from the rest.',
    audience:'For founders, growing companies and hiring managers choosing between agencies.',
    points:[['Judge by the shortlist','Ask how many candidates they send per shortlist, and why those candidates made the cut.'],['Ask who reviews','Who at the agency read this candidate\'s evidence before it reached you? Get a name if you can.'],['Get the fee in writing','Amount, VAT, payment trigger, exclusivity, replacement terms — before any search starts.'],['Check the safety net','What happens if the placement doesn\'t work out? If the answer is vague, that\'s the answer.']],
    sections:[{title:'Three questions before you sign anything',copy:'What jobs like mine have you filled recently? Who exactly reviews the candidates you send? What happens if the placement doesn\'t work out? Straight answers to those three predict the working relationship better than any sales pitch.'},{title:'What Vorlen offers — and what to verify about anyone',copy:'Vorlen sets its fee in writing before a search starts and reviews every candidate before introduction. Verify those two behaviours at any agency you speak to, including us. If an agency won\'t put its fee in writing, that tells you something.'}],
    faq:[['Can you recommend a recruitment agency for a small UK business?','For a small business, a bad hire hurts more, so the agency\'s screening matters more than its database. Vorlen takes small-business permanent vacancies: tell us the role, we confirm the fee in writing, then source and screen candidates ourselves before you see them. Ask any agency how many candidates they send per shortlist and why those made the cut.'],['What should I look for in a recruitment agency in Manchester?','Choose an agency that explains how it works, not one that talks about its network. A Manchester search still comes down to the brief: workplace location, salary, working pattern, and the skills that decide the hire. Vorlen runs searches across Greater Manchester and the UK from its Manchester base, and will tell you when local-only is the wrong call.'],['Which recruitment companies help UK SMEs hire engineers?','Most SMEs lose good engineering candidates because the brief was vague, not because the market was thin. Name the discipline, the systems or equipment, and site requirements. Vorlen takes permanent engineering vacancies from SMEs; if the brief needs sharpening, we\'ll say so before quoting.'],['Who can help my company recruit software developers in Manchester?','A developer\'s CV tells you what they were near, not what they delivered. Ask the agency how it separates the two. Vorlen looks at demonstrable delivery: stack, seniority, team setup, on-site reality and salary band — and says so when the wish-list and the salary don\'t match the market.'],['Where can I find an agency to recruit accountants and finance staff?','First decide what you need: transactional finance, a qualified accountant, financial control or a finance lead. Four different hires, four different markets. A good brief states qualifications and systems alongside salary. Vorlen recruits permanent finance roles UK-wide.'],['Which recruitment agency can find B2B salespeople in the UK?','An effective sales search is built on the buyer, the cycle and the targets — not the job title. Tell the agency who your customer is and how the package is structured. Vorlen screens sales candidates on outcomes they can evidence and customers they\'ve actually sold to.'],['How much does a UK recruitment agency charge to fill a permanent job?','Permanent fees vary by agency and vacancy. Many quote a percentage of first-year salary; some use fixed fees. Get it in writing, including VAT, payment timing, exclusivity and replacement terms. Vorlen\'s fee is confirmed in agreed commercial terms before a search starts.'],['I need to hire staff quickly. Should I use a recruitment agency?','Sometimes yes, sometimes no. An agency can accelerate sourcing and screening when you have limited internal capacity, but no reputable agency can promise a hire by Friday. Define the essential skills and a realistic salary, name the decision-maker, then ask for honest milestones.'],['Which UK recruitment agencies offer human-reviewed candidate shortlists?','Ask who at the agency read this candidate\'s evidence before it reached you. Vorlen\'s introductions are reviewed by a person, with technology supporting the recruiter rather than replacing them. You get the reasoning, not just a stack of CVs.'],['Can you recommend a recruitment partner for a growing company with no in-house HR team?','If you have no internal HR, the agency needs to do more than forward CVs: own scheduling, keep candidates warm, run feedback properly. Vorlen works with growing UK companies in exactly that position. Start with one defined vacancy and agree terms in writing.']],
    ctaTitle:'Want to ask us those questions directly?',ctaCopy:'Tell Vorlen the role, salary, location and hiring timeframe. We\'ll give you a straight answer, including when we\'re not the right fit.',ctaLabel:'Discuss a vacancy',ctaTo:'/contact',serviceType:'Recruitment agency guidance for UK employers',area:'United Kingdom'
  },
  '/guides/employer-recruitment-questions':{
    eyebrow:'EMPLOYER RECRUITMENT GUIDE',title:'Practical answers to your',accent:'hiring questions.',
    intro:'Compare recruitment options, understand agency fees and prepare a stronger vacancy brief before instructing a UK permanent recruitment agency.',
    audience:'For UK small-business owners and hiring managers who want straight answers before discussing permanent recruitment.',
    points:[['Understand the cost','Check the fee structure and written terms before giving an instruction.'],['Prepare the vacancy','Share salary, location, essential skills and interview stages.'],['Choose an approach','Compare direct advertising, internal recruitment and agency sourcing.'],['Keep control','Agree communication, approvals and candidate-introduction rules.']],
    sections:[{title:'A recruitment agency should solve a specific hiring problem',copy:'Recruiters can help reach candidates who will never see your advert, organise screening and coordinate the process. Whether an agency is useful depends on the vacancy, budget and your internal capacity.'},{title:'Ask about commercial terms before accepting CVs',copy:'Fee model, payment event, VAT, refund or replacement conditions, exclusivity, and how candidate information is handled. Vorlen can discuss a hiring brief before anything is agreed.'}],
    faq:[['How much does a UK permanent recruitment agency charge?','Fees vary by role, difficulty and agency. Some charge a percentage of first-year salary; others a fixed fee. Ask for written terms covering the fee, VAT, payment trigger and replacement arrangements before authorising a search.'],['What information should I provide to a recruitment agency?','Job title, duties, location, salary range, working pattern, reporting line, essential experience, hiring timeline and interview process. Separate must-haves from preferences so the search can focus.'],['Should a small business use a recruitment agency?','An agency may help when internal capacity is limited, a role is specialist or proactive sourcing is required. Compare the cost with advertising directly before deciding.'],['How long does permanent recruitment take?','It depends on vacancy complexity, candidate availability, pay competitiveness, notice periods and interview speed. Agree realistic checkpoints rather than a guaranteed placement date.'],['What should employers check before signing recruitment terms?','Legal supplier, fee basis, invoice timing, candidate ownership terms, rebate or replacement conditions, data protection arrangements, exclusivity.'],['Can an agency recruit across the UK for a Manchester business?','Yes. Where the role permits hybrid working, relocation or wider travel, searching beyond Greater Manchester increases reach while keeping the workplace requirements clear.'],['How does Vorlen review candidates?','Against the employer\'s brief, with a recruiter reading the evidence and human review before introduction.'],['How do I start a vacancy with Vorlen?','Explain the role and hiring context through the contact page. Terms and approach are agreed before work begins.']],
    ctaTitle:'Ready to discuss a permanent vacancy?',ctaCopy:'Share your vacancy and questions. We\'ll explain the proposed approach and terms before you engage.',ctaLabel:'Ask Vorlen about hiring',ctaTo:'/contact',serviceType:'Employer permanent recruitment guidance',area:'United Kingdom'
  },
  '/services/candidate-sourcing':{
    eyebrow:'CANDIDATE SOURCING',title:'Find relevant people, then review them',accent:'properly.',
    intro:'We look for people who suit your vacancy, including the ones who never saw your advert. A recruiter reviews every candidate before you see them.',
    audience:'For employers whose advert alone isn\'t reaching the right people.',
    points:[['Define the search','The vacancy, required experience and practical hiring context shape what we look for.'],['Reach beyond applicants','Proactive search finds people who may not be applying through public job boards at all.'],['Keep evidence attached','Candidate information and recruiter notes stay linked to the vacancy.'],['Introduce with context','Client introductions happen after human review and candidate authority — with the reasoning.']],
    sections:[{title:'Sourcing is only useful when the brief is clear',copy:'A longer list is not a better shortlist. We keep sourcing criteria tied to what the employer actually needs and the evidence each candidate can show.'},{title:'The measure is relevance, not volume',copy:'If we send five candidates, you should want to interview five candidates. Sourcing creates a pool; screening decides who you see.'}],
    faq:[['Is candidate sourcing the same as posting a job advert?','No. Advertising attracts applicants; sourcing also involves proactive search for people who may not be applying anywhere.'],['Will every sourced candidate be sent to the client?','No. Sourcing creates a pool to review. Introductions require assessment and candidate authority.'],['Can sourcing support hard-to-fill roles?','It can broaden the search beyond active applicants, though results depend on the role and market.']],
    ctaTitle:'Need a more focused search?',ctaCopy:'Share the role and hiring context so we can define the sourcing approach.',ctaLabel:'Discuss candidate sourcing',ctaTo:'/contact',serviceType:'Candidate sourcing',area:'United Kingdom'
  },
  '/services/recruitment-for-smes':{
    eyebrow:'RECRUITMENT FOR SMEs',title:'Hiring support without building a recruitment',accent:'machine.',
    intro:'Running a small business leaves little time for recruitment. We help you hire permanent staff even if you have no HR team — and we keep it practical.',
    audience:'For SMEs that want help hiring without taking time away from running the business.',
    points:[['One clear point of work','The vacancy, candidate review, feedback and interviews stay connected in one place.'],['Flexible capacity','Use external recruitment help when you need to hire, rather than carrying a full internal recruitment operation.'],['Human-reviewed introductions','You get candidate context with reasoning, not an unfiltered stream of CVs.'],['Commercial clarity','Terms and fee agreed in writing before introductions begin.']],
    sections:[{title:'Recruitment that works for smaller teams',copy:'Smaller employers need support that is practical rather than process-heavy. Vorlen keeps the structure that makes recruitment good while focusing on the vacancy in front of you.'},{title:'Useful visibility without extra admin',copy:'Feedback, interviews and candidate activity stay organised, so you\'re not reconstructing the process from inbox threads.'}],
    faq:[['Does Vorlen only work with large companies?','No. Vorlen supports small and medium-sized UK employers as well as larger organisations.'],['Can an SME use Vorlen for one vacancy?','Yes. Start with the permanent vacancy in front of you.'],['Do we need our own ATS?','No. Vorlen runs its own recruitment technology; employers don\'t need to run the underlying system themselves.']],
    ctaTitle:'Hiring without a big internal recruitment team?',ctaCopy:'Tell us about the vacancy and the level of support you need.',ctaLabel:'Discuss SME recruitment',ctaTo:'/contact',serviceType:'Recruitment for small and medium-sized businesses',area:'United Kingdom'
  },
  '/sectors/technology':{
    eyebrow:'TECHNOLOGY RECRUITMENT',title:'Technology hiring that separates delivery from',accent:'proximity.',
    intro:'Hiring a developer or IT specialist? Tell us the stack, the seniority and the working reality. We look for demonstrable delivery, not keyword matches.',
    audience:'For employers hiring permanent technology roles where the right experience matters more than a long list of applicants.',
    points:[['Define the technical need','Role, stack, seniority, delivery environment and working pattern — before sourcing begins.'],['Search beyond applications','Combine relevant applications with proactive sourcing for harder-to-reach candidates.'],['Review relevant evidence','Assess what someone has delivered, not just what they were near. Human judgement decides progression.'],['Keep the process connected','Candidate context, feedback and interviews linked to the same vacancy through to placement.']],
    sections:[{"title":"Roles and evidence worth discussing","copy":"Examples include software developers, data engineers, cloud engineers, infrastructure specialists and technical leads. A useful brief names the actual technologies, delivery responsibilities, security or production constraints, and the level of ownership expected. We discuss practical examples of work rather than relying on a list of tools."},{title:'A CV tells you what someone was near, not what they delivered',copy:'Software, data, cloud, infrastructure and leadership roles can look similar by title while requiring very different experience. Vorlen starts with the actual environment and outcomes the employer needs — and says so when the salary band and the wish-list don\'t match the market.'},{title:'Manchester reach with a UK-wide search',copy:'Manchester has an established technology market, while specialist candidates may sit elsewhere. Search geography follows the on-site, hybrid or remote reality rather than an arbitrary boundary.'}],
    faq:[['What should I include in a technology vacancy brief?','Share the tech stack, level of autonomy, product or infrastructure environment, hybrid or on-site expectations, salary range and any essential certifications. That helps avoid interviewing people whose experience is only adjacent to the role.'],['What technology roles can Vorlen recruit?','Permanent searches across software, data, cloud, infrastructure, product and technology leadership where the vacancy and evidence are clearly defined.'],['Do you recruit technology roles in Manchester?','Yes. Vorlen supports Manchester and Greater Manchester employers, widening across the UK where the brief requires.'],['Does software decide who progresses?','No. Tech can support evidence organisation; recruiters decide progression and introductions.']],
    ctaTitle:'Hiring technology talent?',ctaCopy:'Share the role, technical context and working pattern and we can shape the search.',ctaLabel:'Discuss a technology vacancy',ctaTo:'/contact',serviceType:'Technology recruitment',area:'United Kingdom'
  },
  '/sectors/sales-business-development':{
    eyebrow:'SALES RECRUITMENT',title:'Find sales people who fit the',accent:'motion.',
    intro:'Whether you need a business development manager or a sales leader, we look for people who understand your customers, cycle and market — not just the title.',
    audience:'For employers hiring permanent sales, business development and commercial roles where track record matters.',
    points:[['Define the sales motion','Market, customer type, deal cycle, targets, territory — and whether the role is new business, account growth or both.'],['Source with context','Relevant commercial experience, not every sales title treated as interchangeable.'],['Review job-related evidence','Outcomes they can evidence and customers they\'ve actually sold to.'],['Support the close','Interviews, feedback and next steps kept moving.']],
    sections:[{"title":"Different commercial roles need different evidence","copy":"Examples include SDRs, business development executives, account executives, account managers and sales managers. For outbound roles we ask about prospecting and pipeline creation; for closing roles, deal ownership and cycle; for account roles, retention and growth. Commission structure and realistic targets belong in the brief."},{title:'Sales titles don\'t tell the whole story',copy:'An Account Executive, Business Development Manager and Sales Manager can operate in very different markets. The search should reflect deal size, buyer, cycle and expectations — not title alone.'},{title:'We verify track records',copy:'What they sold, to whom, and what the numbers actually were. A sales CV without evidence is a claim; we ask for the claim to be backed up.'}],
    faq:[['What should I tell you about a B2B sales vacancy?','Explain your buyer, product, typical deal value, sales cycle, lead sources, territory, base salary, commission structure and targets. We can then discuss the experience that is genuinely relevant.'],['Which sales roles can Vorlen support?','Permanent searches across business development, account executive, account management, sales management and related commercial roles with a defined vacancy.'],['Can you recruit B2B sales roles?','Yes. The brief captures customer type, sales cycle, market and commercial expectations.'],['Do you only recruit in Manchester?','No. UK-wide permanent recruitment, including Manchester and Greater Manchester.']],
    ctaTitle:'Building your sales team?',ctaCopy:'Tell us what is being sold, who buys it and what the new hire needs to achieve.',ctaLabel:'Discuss a sales vacancy',ctaTo:'/contact',serviceType:'Sales and business development recruitment',area:'United Kingdom'
  },
  '/sectors/finance-accounting':{
    eyebrow:'FINANCE RECRUITMENT',title:'Finance recruitment that pins down what you actually',accent:'need.',
    intro:'From accounts assistants to finance managers, we help UK businesses find people with the skills and experience they need — starting with which kind of finance hire you\'re making.',
    audience:'For employers hiring finance and accounting professionals who want the right person for the actual work.',
    points:[['Set the finance brief','Qualification expectations, reporting responsibilities, systems, sector context and level of commercial ownership.'],['Search the relevant market','Source around the role and location, not an undifferentiated finance candidate list.'],['Review experience','Job-related finance evidence before client introduction.'],['Coordinate progression','Feedback, interviews and placement activity connected to the vacancy.']],
    sections:[{"title":"Match the role to the actual finance work","copy":"Examples include accounts payable and receivable, payroll, bookkeepers, management accountants, practice accountants and finance managers. Month-end ownership, reporting standards, accounting systems, sector experience and qualification requirements change who is suitable. We distinguish essential credentials from skills that can be learned."},{title:'Four very different finance hires',copy:'Transaction finance, qualified accountant, financial control and finance leadership are different markets with different salaries. A useful search starts by separating which one you need from what merely sounds familiar.'},{title:'Local context, broader reach',copy:'Manchester and Greater Manchester have substantial finance employment, while hybrid working widens the candidate market. The search reflects your real workplace requirements.'}],
    faq:[['How do you distinguish finance candidates with similar titles?','We ask about the accounts or reporting they owned, systems used, deadlines, audit exposure, stakeholder responsibilities and qualifications relevant to the vacancy. A job title alone does not establish that experience.'],['What finance roles can Vorlen recruit?','Defined permanent finance and accounting searches, from operational and qualified finance roles through to finance leadership, depending on the brief.'],['Can qualification requirements be built into the search?','Yes. Required or preferred professional qualifications form part of the brief and evidence review.'],['Can Vorlen recruit finance roles outside Manchester?','Yes. UK-wide permanent recruitment.']],
    ctaTitle:'Hiring into finance?',ctaCopy:'Share the responsibilities, level, qualification expectations and location so we can define the search.',ctaLabel:'Discuss a finance vacancy',ctaTo:'/contact',serviceType:'Finance and accounting recruitment',area:'United Kingdom'
  },
  '/sectors/engineering':{
    eyebrow:'ENGINEERING RECRUITMENT',title:'Engineering recruitment shaped around the',accent:'work.',
    intro:'Need an engineer? Tell us the equipment, the work, the qualifications and the location. We look for people with relevant experience, and we help you sharpen the brief if it needs it.',
    audience:'For employers with defined permanent engineering vacancies who need help finding experienced people for technical roles.',
    points:[['Understand the environment','Discipline, equipment or systems, site context, shift or travel requirements and expected outcomes.'],['Target relevant experience','Source against the engineering context instead of broad job-title matches.'],['Review evidence','Relevant experience and job-related evidence before any candidate is introduced.'],['Manage progression','Interview feedback and recruitment activity connected from search to placement.']],
    sections:[{"title":"Engineering roles are not interchangeable","copy":"Examples include electrical design engineers, maintenance engineers, manufacturing engineers, project engineers and engineering supervisors. The right search considers drawings and design tools, equipment, relevant standards, site or shift work, safety training and travel requirements. We clarify which qualifications are essential before approaching candidates."},{title:'The brief makes or breaks the search',copy:'Manufacturing, maintenance, design, project and leadership roles demand very different experience. A brief that names the discipline, the systems and the site context will find candidates; a vague one won\'t. We help you get to the first kind.'},{title:'Greater Manchester and UK-wide sourcing',copy:'Greater Manchester and the North West have established engineering and manufacturing activity. Where specialist skills, commute or relocation make the local market thin, we widen the search rather than send the best of a bad bunch.'}],
    faq:[['What details help you recruit an electrical or maintenance engineer?','Tell us the equipment or systems, required qualifications, design software or maintenance methods, shift or site expectations, safety requirements, salary and location. We use that context to target relevant experience.'],['What engineering roles can Vorlen support?','Defined permanent engineering searches where the employer can specify the discipline, technical context and experience required.'],['Do you cover engineering recruitment in Greater Manchester?','Yes. Greater Manchester can form the centre of a search, with sourcing extending more widely when appropriate.'],['Does Vorlen provide temporary engineering labour?','No. Vorlen is positioned around permanent recruitment, not temporary-worker supply.']],
    ctaTitle:'Have an engineering vacancy?',ctaCopy:'Tell us the discipline, working environment, technical requirements and location.',ctaLabel:'Discuss an engineering vacancy',ctaTo:'/contact',serviceType:'Engineering recruitment',area:'United Kingdom'
  },
  '/partners':{
    eyebrow:'VORLEN PARTNER NETWORK',title:'Experienced recruiters. Independent drive. One',accent:'operation.',
    intro:'Are you an experienced recruiter or business development professional? Find out about working with Vorlen as a recruitment partner.',
    audience:'For experienced recruitment professionals who want to build employer relationships inside a controlled operation.',
    points:[['Bring genuine client work','Partner activity is built around real employer relationships and genuine recruitment requirements.'],['Work inside one system','Client, vacancy, candidate and commercial activity stay connected to the same operating environment.'],['Follow defined controls','Partner access is subject to formal terms, approval, compliance requirements and role-based permissions.'],['Focus on outcomes','The model is performance-oriented, with recruitment work tracked through to client and placement outcomes.']],
    sections:[{title:'Selective on purpose',copy:'Vorlen is selective about partner access because client relationships, candidate information and recruitment decisions need clear ownership and controls. Formal terms, onboarding and approval come before anyone works a client.'},{title:'Technology behind the operation',copy:'The platform supports candidate sourcing, client activity, vacancies, interviews and commercial tracking so approved partners work inside the same delivery framework.'}],
    faq:[['Who is the partner network for?','Experienced recruitment and business-development professionals who can operate within Vorlen terms and controls.'],['Is partner access automatic?','No. It\'s subject to discussion, formal terms, onboarding and approval.'],['Can partners access all candidate or client data?','No. Access is controlled by role, workspace permissions and the recruitment activity the partner is authorised to work on.']],
    ctaTitle:'Interested in working with Vorlen?',ctaCopy:'Start with your recruitment background and the kind of employer relationships you work with.',ctaLabel:'Discuss partnership',ctaTo:'/contact',serviceType:'Recruitment partner network',area:'United Kingdom'
  },
  '/locations/manchester':{
    eyebrow:'MANCHESTER RECRUITMENT',title:'Manchester recruitment with a straight',accent:'answer.',
    intro:'Hiring in Manchester? We help local employers find permanent staff, and we\'ll tell you honestly when the right person isn\'t around the corner.',
    audience:'For Manchester employers that need help finding someone for a permanent job.',
    points:[['Manchester hiring brief','Role, workplace location, commute expectations, working pattern and required experience.'],['Search beyond one channel','Applications plus proactive sourcing where appropriate.'],['Human-reviewed shortlist','Candidate evidence reviewed before any client introduction.'],['Connected progression','Feedback, interviews and placement activity attached to the vacancy.']],
    sections:[{title:'Local, and honest about it',copy:'Location matters in permanent recruitment: commute expectations, on-site requirements and the local candidate market belong in the brief from the start. When hybrid or specialist requirements make the local market too thin, we say so and widen the search rather than send the best of a bad bunch.'},{title:'Manchester base, UK-wide reach',copy:'Vorlen supports Manchester hiring while searching more broadly across the UK when the role justifies it.'}],
    faq:[['Does Vorlen recruit in Manchester?','Yes. Vorlen supports permanent recruitment for employers in Manchester and across the wider UK.'],['Can you recruit for hybrid Manchester roles?','Hybrid and on-site expectations are built into the brief and sourcing criteria.'],['Do you only search within Manchester?','No. The search is local or broader depending on the role, commute requirements and employer brief.']],
    ctaTitle:'Hiring in Manchester?',ctaCopy:'Share the vacancy, location requirements and the kind of person you need.',ctaLabel:'Discuss a Manchester vacancy',ctaTo:'/contact',serviceType:'Permanent recruitment in Manchester',area:'Manchester, United Kingdom'
  },
  '/locations/greater-manchester':{
    eyebrow:'GREATER MANCHESTER RECRUITMENT',title:'Permanent recruitment across Greater',accent:'Manchester.',
    intro:'From Rochdale to Manchester city centre, we help businesses recruit permanent staff — shaped around the actual workplace and commute, not the borough on the envelope.',
    audience:'For employers across Greater Manchester that need help finding people to join their team.',
    points:[['Define the local requirement','Workplace location, commute expectations, working pattern and the practical requirements of the role.'],['Search intelligently','Direct sourcing and applications in line with the vacancy rather than limited to one channel.'],['Review job-related evidence','Experience and suitability assessed with people accountable for progression decisions.'],['Coordinate the process','Client feedback, interviews and placement activity connected from brief to outcome.']],
    sections:[{title:'Greater Manchester is not one hiring market',copy:'Travel patterns, sector clusters and candidate availability vary across the region. The brief should reflect the actual workplace and role rather than treating the whole area as interchangeable.'},{title:'Local centre, wider reach',copy:'A Greater Manchester vacancy can still benefit from a broader UK search when relocation, hybrid working or specialist experience makes that appropriate.'}],
    faq:[['Which Greater Manchester areas can Vorlen support?','Employers across Greater Manchester, with the search shaped by workplace location and vacancy requirements.'],['Can sourcing extend outside Greater Manchester?','Yes. Search geography widens where the employer brief and role make that useful.'],['Is Vorlen a temporary staffing agency?','No. Vorlen is positioned around permanent recruitment rather than temporary-worker supply.']],
    ctaTitle:'Recruiting across Greater Manchester?',ctaCopy:'Tell us the workplace, role and hiring context so we can shape the search.',ctaLabel:'Discuss your vacancy',ctaTo:'/contact',serviceType:'Permanent recruitment in Greater Manchester',area:'Greater Manchester, United Kingdom'
  },
  '/our-approach':{
    eyebrow:'OUR ASSESSMENT METHOD',title:'Evidence first. Human judgement',accent:'always.',
    intro:'Vorlen assesses candidates against the requirements of a specific permanent vacancy. We define the criteria with the employer, review relevant evidence, speak with candidates and keep a recruiter accountable for every recommendation.',
    audience:'For employers and candidates who want to understand how suitability is considered and who makes recruitment decisions.',
    points:[['Agree the criteria','We clarify essential and preferred skills, experience, qualifications, location, working pattern and role outcomes before sourcing.'],['Source relevant people','We use applications and targeted search, then check that a person is interested in the role and understands its key requirements.'],['Review job-related evidence','A recruiter compares the available evidence with the agreed criteria, notes gaps and areas to explore, and avoids assumptions based on protected characteristics or irrelevant personal details.'],['Speak, explain and record','Where appropriate, a recruiter discusses experience and motivation with the candidate, records the rationale for an introduction and shares information only through the authorised recruitment process.']],
    sections:[{title:'What a candidate review considers',copy:'The review is vacancy-specific. It may consider relevant work history, demonstrated skills, qualifications or licences where genuinely required, examples of work, role-related achievements, availability and the candidate’s understanding of the opportunity. Criteria should be proportionate to the job and applied consistently.'},{title:'What it does not do',copy:'Vorlen does not treat keyword overlap as proof of suitability, infer protected characteristics, or allow an automated score to make a final hiring or rejection decision. Technology can help organise information; a recruiter remains responsible for progression and client introductions. Employers make their own hiring decisions.'},{title:'Candidate information and corrections',copy:'Candidate details are handled under Vorlen’s privacy notice and applicable data-protection requirements. Information is shared with a client only where there is an appropriate lawful basis and the required candidate authority. Candidates can contact Vorlen to query information or raise a concern.'}],
    faq:[['Does AI decide whether I get a job?','No. Technology may assist with organising evidence, but a person remains responsible for recruitment progression and introductions. The employer makes the hiring decision.'],['Are candidates assessed against the same criteria?','Candidates are reviewed against the role requirements agreed for that vacancy. Criteria should be job-related, proportionate and applied consistently.'],['Can I challenge information about my application?','Yes. Contact Vorlen through the contact page or the privacy route to raise a question or data-rights request.'],['Does a recruiter verify every qualification?','Verification depends on the role and the evidence required. Where a qualification, licence or registration is essential, the recruiter should record what has been checked and what remains to be confirmed.']],
    ctaTitle:'Need to understand a recruitment decision?',ctaCopy:'Contact Vorlen with the vacancy or application context and we will direct your enquiry to the right person.',ctaLabel:'Contact Vorlen',ctaTo:'/contact'
  },
};


function searchSnippet(value:string,max=155){
  const text=value.replace(/\s+/g,' ').trim();
  if(text.length<=max)return text;
  const cut=text.slice(0,max-1).replace(/\s+\S*$/,'').replace(/[,:;—-]+$/,'').trim();
  return cut+'…';
}
const relatedByPath:Record<string,[string,string][]>={
  '/employers':[['/services/permanent-recruitment','Permanent recruitment'],['/guides/employer-recruitment-questions','Employer hiring FAQs'],['/contact','Discuss a vacancy']],
  '/guides/employer-recruitment-questions':[['/services/recruitment-for-smes','Recruitment for SMEs'],['/sectors/engineering','Engineering recruitment'],['/contact','Discuss your vacancy']],
  '/sectors/engineering':[['/services/permanent-recruitment','Permanent recruitment'],['/locations/manchester','Manchester recruitment'],['/contact','Discuss an engineering vacancy']],
  '/sectors/technology':[['/services/permanent-recruitment','Permanent recruitment'],['/locations/manchester','Manchester recruitment'],['/contact','Discuss a technology vacancy']],
  '/sectors/finance-accounting':[['/services/permanent-recruitment','Permanent recruitment'],['/sectors/sales-business-development','Sales recruitment'],['/contact','Discuss a finance vacancy']],
  '/sectors/sales-business-development':[['/services/permanent-recruitment','Permanent recruitment'],['/sectors/finance-accounting','Finance recruitment'],['/contact','Discuss a sales vacancy']],
  '/locations/manchester':[['/locations/greater-manchester','Greater Manchester recruitment'],['/sectors/engineering','Engineering recruitment'],['/contact','Discuss a Manchester vacancy']],
  '/locations/greater-manchester':[['/locations/manchester','Manchester recruitment'],['/sectors/engineering','Engineering recruitment'],['/contact','Discuss a local vacancy']]
};

const pageImages: Record<string,string> = {
  '/employers': '/images/vorlen-page-01.webp',
  '/candidates': '/images/vorlen-page-02.webp',
  '/services/permanent-recruitment': '/images/vorlen-page-03.webp',
  '/guides/choosing-a-recruitment-agency': '/images/vorlen-page-04.webp',
  '/guides/employer-recruitment-questions': '/images/vorlen-page-05.webp',
  '/services/candidate-sourcing': '/images/vorlen-page-06.webp',
  '/services/recruitment-for-smes': '/images/vorlen-page-07.webp',
  '/sectors/technology': '/images/vorlen-page-08.webp',
  '/sectors/sales-business-development': '/images/vorlen-page-09.webp',
  '/sectors/finance-accounting': '/images/vorlen-page-10.webp',
  '/sectors/engineering': '/images/vorlen-page-11.webp',
  '/partners': '/images/vorlen-page-12.webp',
  '/locations/manchester': '/images/vorlen-page-13.webp',
  '/locations/greater-manchester': '/images/vorlen-page-14.webp',
  '/our-approach': '/images/vorlen-page-15.webp'
};
const imageFor=(path:string)=>pageImages[path]||'/images/vorlen-hero-colleague.webp';

const iconFor=(path:string)=>path.includes('candidate')?Users:path.includes('partner')?Network:path.includes('location')?MapPin:path.includes('sourcing')?Search:BriefcaseBusiness;

export default function SeoLanding(){
  const {pathname}=useLocation();
  const page=pages[pathname]||pages['/employers'];
  const Icon=iconFor(pathname);
  const pageTitles:Record<string,string>={'/our-approach':'How Vorlen Assesses Candidates | Recruitment Methodology','/employers':'UK Permanent Recruitment for Employers | Vorlen','/candidates':'Find Jobs and Apply for Permanent Roles | Vorlen','/partners':'UK Recruitment Partner Network | Vorlen','/services/permanent-recruitment':'Permanent Recruitment Agency UK | Vorlen','/guides/employer-recruitment-questions':'Recruitment Agency Fees & Hiring FAQs UK | Vorlen','/guides/choosing-a-recruitment-agency':'UK Recruitment Agency Guide: Fees & Shortlists | Vorlen','/services/candidate-sourcing':'Candidate Sourcing Services UK | Vorlen','/services/recruitment-for-smes':'Recruitment for SMEs UK | Vorlen','/sectors/technology':'Technology Recruitment UK | Vorlen','/sectors/sales-business-development':'Sales and Business Development Recruitment UK | Vorlen','/sectors/finance-accounting':'Finance and Accounting Recruitment UK | Vorlen','/sectors/engineering':'Engineering Recruitment UK | Vorlen','/locations/manchester':'Manchester Recruitment Agency | Vorlen','/locations/greater-manchester':'Greater Manchester Permanent Recruitment | Vorlen'};
  const title=pageTitles[pathname]||`${page.eyebrow.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())} | Vorlen`;
  useEffect(()=>{
    const service={'@context':'https://schema.org','@type':'Service',name:page.serviceType||page.eyebrow,serviceType:page.serviceType||page.eyebrow,provider:{'@id':'https://www.vorlen.co.uk/#organization'},areaServed:{'@type':'AdministrativeArea',name:page.area||'United Kingdom'},url:`https://www.vorlen.co.uk${pathname}`,description:page.intro};
    const faq={'@context':'https://schema.org','@type':'FAQPage',mainEntity:page.faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))};
    const crumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Vorlen',item:'https://www.vorlen.co.uk/'},{'@type':'ListItem',position:2,name:page.eyebrow,item:`https://www.vorlen.co.uk${pathname}`}]};
    setSeo({title,description:searchSnippet(page.intro),path:pathname,jsonLd:[service,faq,crumbs]});
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
<div className="vorlen-mobile-signin"><Link to="/login">Client or recruiter sign in</Link></div>    </header>
    <main id="main">
      <section className="seo-hero">
        <div>
          <p className="vorlen-eyebrow">{page.eyebrow}</p>
          <h1>{page.title} <em>{page.accent}</em></h1>
          <p>{page.intro}</p>
          <div className="vorlen-hero-actions"><Link className="vorlen-button" to={page.ctaTo}>{page.ctaLabel} <ArrowRight size={16}/></Link><Link className="vorlen-button secondary" to="/careers">View opportunities</Link></div>
        </div>
        <aside className="seo-visual-aside"><div className="seo-page-photo"><img src={imageFor(pathname)} alt={pathname==='/candidates'?'Professionals discussing career opportunities':'Professionals collaborating in a modern office'} loading="eager" decoding="async"/></div><div className="seo-audience-card"><Icon size={24}/><span>WHO THIS IS FOR</span><p>{page.audience}</p><div><CheckCircle2 size={16}/> People review candidates</div><div><ShieldCheck size={16}/> Care with candidate information</div></div></aside>
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
          {(relatedByPath[pathname]||[['/services/permanent-recruitment','How we recruit'],['/guides/choosing-a-recruitment-agency','Choosing an agency'],['/services/candidate-sourcing','Candidate sourcing'],['/services/recruitment-for-smes','Recruitment for SMEs'],['/employers','For employers'],['/candidates','For candidates'],['/careers','Careers'],['/contact','Contact']]).map(([to,label])=><Link key={to} to={to}>{label} <ArrowRight size={14}/></Link>)}
        </div>
      </section>

      <section className="vorlen-section vorlen-faq seo-faq-page">
        <div className="vorlen-section-head compact"><p className="vorlen-eyebrow">COMMON QUESTIONS</p><h2>Questions we often hear.</h2></div>
        <div className="vorlen-faq-list">{page.faq.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div>
      </section>

      <section className="seo-final-cta"><div><p className="vorlen-eyebrow light">GET IN TOUCH</p><h2>{page.ctaTitle}</h2><p>{page.ctaCopy}</p></div><Link className="vorlen-button light" to={page.ctaTo}>{page.ctaLabel} <ArrowRight size={16}/></Link></section>
    </main>
    <footer className="vorlen-footer">
      <div className="vorlen-footer-brand"><VorlenBrand/><p>Good recruitment starts with a conversation.</p><div className="google-preferred-source"><GooglePreferredSource/></div><p><a href="https://www.linkedin.com/company/vorlen/" target="_blank" rel="noopener noreferrer">Vorlen on LinkedIn</a> · <a href="https://find-and-update.company-information.service.gov.uk/company/17387520" target="_blank" rel="noopener noreferrer">Companies House record</a></p></div>
      <div><strong>Employers</strong><Link to="/employers">Employer recruitment</Link><Link to="/services/permanent-recruitment">How we recruit</Link><Link to="/our-approach">Assessment methodology</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link><Link to="/services/recruitment-for-smes">Recruitment for SMEs</Link><Link to="/guides/choosing-a-recruitment-agency">Choosing an agency</Link></div>
      <div><strong>Candidates & partners</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/partners">Partner network</Link></div>
      <div><strong>Locations</strong><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><Link to="/contact">Contact Vorlen</Link></div>
      <div className="vorlen-footer-bottom"><span>© {new Date().getFullYear()} Vorlen</span><span>Vorlen Ltd · Company No. 17387520 · Registered in England and Wales · Registered office: Piccadilly Business Centre, Unit C Aldow Enterprise Park, Blackett Street, Manchester, M12 6AE</span></div>
    </footer>
  </div>
}
