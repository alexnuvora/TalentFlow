import {CookieSettingsLink} from '../components/WebsitePrivacy';
import MarketingHeader from '../components/MarketingHeader';
import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import '../privacy-notice.css';
import {setSeo} from '../lib/seo';
import MarketingFooter from '../components/MarketingFooter';

const contents=[["controller","Who we are"],["operating-model","Operating model"],["information","Information we collect"],["sources","Where information comes from"],["lawful-bases","How we use information"],["enquiry-attribution","Enquiry attribution"],["cookies","Cookies and analytics"],["applications","Candidate applications"],["ai-recruitment","AI-assisted recruitment"],["sharing","Information sharing"],["transfers","International transfers"],["retention","Retention"],["marketing","Direct marketing"],["security","Security"],["rights","Your rights"],["ico","ICO registration"],["changes","Changes to this notice"]];
export default function Privacy(){
 const {hash}=useLocation();
 useEffect(()=>setSeo({
  title:'Privacy notice | Vorlen',
  description:'How Vorlen Ltd handles personal information for recruitment, client development, partner operations and website enquiries.',
  path:'/privacy'
 }),[]);
 useEffect(()=>{const id=hash.slice(1);if(contents.some(([key])=>key===id))document.getElementById(id)?.scrollIntoView({block:'start'})},[hash]);
 return <div className="legal-public privacy-notice-page">
  <MarketingHeader/>
  <main id="privacy-top">
   <div className="privacy-intro">
   <div className="legal-kicker">PRIVACY NOTICE · VERSION 28 NOVEMBER 2026</div>
   <h1>Privacy notice</h1>
   <p className="legal-lead">This notice explains how Vorlen Ltd uses personal information when providing permanent recruitment services, operating its partner and client workspaces, developing business relationships and responding to enquiries.</p>
   <div className="privacy-quick-links"><a href="#cookies">Cookie and analytics policy</a><CookieSettingsLink/><a href="mailto:privacy@vorlen.co.uk">Contact our privacy team</a></div>
   </div>
   <div className="privacy-reading-layout">
    <aside className="privacy-contents"><nav aria-label="Privacy notice contents"><h2>On this page</h2><ol>{contents.map(([id,label])=><li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol></nav></aside>
    <article className="privacy-document" aria-label="Privacy notice sections">

   <section id="controller"><h2>Who is responsible for your information</h2>
    <p><strong>Vorlen Ltd</strong>, company number <strong>17387520</strong>, registered in England and Wales with registered office at <strong>Piccadilly Business Centre, Unit C Aldow Enterprise Park, Blackett Street, Manchester, M12 6AE</strong>, trading as <strong>Vorlen</strong>, is the controller for the personal information described in this notice unless another organisation is clearly identified as the controller for a particular activity.</p>
    <p>Privacy enquiries can be sent to <a href="mailto:privacy@vorlen.co.uk">privacy@vorlen.co.uk</a>.</p>
   </section>

   <section id="operating-model"><h2>Our staged operating model</h2>
    <p>Vorlen uses technical compliance gates before candidate-processing features can operate. Candidate applications, sourcing, screening and introductions are available only when the relevant workspace compliance controls are active. If you apply for a role, register interest, use a secure candidate portal or otherwise ask Vorlen to provide work-finding services, the candidate sections of this notice apply to that processing.</p>
   </section>

   <section id="information"><h2>Information we may collect</h2>
    <p>Depending on your relationship with Vorlen, we may process:</p>
    <ul>
     <li>identity and contact details, including name, email address, telephone number, location and postal address;</li>
     <li>candidate CVs, work history, skills, experience, training, qualifications, professional authorisations, application answers and interview information;</li>
     <li>for recruitment-agency statutory records, whether a work-seeker is under 22 and, where required, their date of birth;</li>
     <li>job preferences, availability, application and introduction history, communications, notes and portal activity;</li>
     <li>client and business-contact details, recruitment requirements, vacancy information, commercial records and communications;</li>
     <li>partner onboarding, agreement, business-administration and commission information;</li>
     <li>security, authentication, audit and fraud-prevention information; and</li>
     <li>marketing preferences and suppression/opt-out records.</li>
    </ul>
    <p>We do not ask candidates to provide special-category information unless it is genuinely necessary for a lawful recruitment purpose. If such information is required, an appropriate additional condition and safeguards must apply.</p>
   </section>

   <section id="sources"><h2>Where information comes from</h2>
    <p>Information may come directly from you; from a hirer or prospective hirer; from a Vorlen partner acting within an authorised role; from recruitment activity you have participated in; or, where lawful and appropriate, from professional or publicly available business sources. If Vorlen obtains personal information indirectly, we provide the required privacy information within the applicable UK GDPR timeframe unless an exemption applies.</p>
   </section>

   <section id="lawful-bases"><h2>Why we use information and our lawful bases</h2>
    <p>We use personal information only where we have a lawful basis. The basis depends on the activity:</p>
    <ul>
     <li><strong>Steps at your request before a contract / provision of work-finding services:</strong> receiving applications, registering interest and taking recruitment steps you ask us to take.</li>
     <li><strong>Legitimate interests:</strong> operating a recruitment business, managing client and partner relationships, keeping accurate recruitment records, service improvement, security, fraud prevention and proportionate B2B business development. We assess whether those interests are overridden by individual rights.</li>
     <li><strong>Legal obligation:</strong> records and checks that recruitment agencies must maintain or obtain, and other applicable legal, tax, accounting or regulatory requirements.</li>
     <li><strong>Consent:</strong> only where the law requires consent or where we choose consent as the appropriate basis, for example certain marketing or optional processing. Consent is kept separate from access to core work-finding services and can be withdrawn.</li>
    </ul>
    <p>A privacy acknowledgement in an application confirms that you have seen this notice; it is not used to convert processing that relies on contract steps, legal obligation or legitimate interests into consent-based processing.</p>
   </section>

   <section id="enquiry-attribution"><h2>Website enquiry attribution</h2><p>When you submit a public enquiry, we may save the public landing-page path, recognised search-engine referral category where available and any supplied campaign labels alongside your enquiry. This helps us understand which resources lead to enquiries and improve our recruitment service, on the basis of legitimate interests. During navigation this limited context is held in page memory; this attribution feature does not use cookies, browser storage, advertising identifiers or third-party tracking requests. We do not retain full referral URLs or other query parameters through this feature.</p></section>
   <section id="cookies"><h2>Cookie and analytics policy</h2>
    <p>Essential technologies support secure sign-in, session management, fraud prevention and requested recruitment services. The <code>vorlen_privacy_v1</code> browser storage entry saves your analytics choice and its date for 180 days; it contains no visitor identifier. If browser storage is unavailable, the choice lasts only in page memory.</p>
    <p>Optional first-party analytics are off unless you affirmatively accept them. We count visits to public pages, broad traffic-source categories and completed employer enquiries, candidate applications and interest registrations. General site measurement records only daily aggregate counts, public page categories and broad sources; it does not store visitor IDs, full URLs, search terms, CVs, contact details or form answers. Hosting and security services may process network information to deliver and protect the service.</p>
    <p>With analytics permission, recruitment campaign measurement may also record the campaign, referral link, public opportunity, event type and supplied campaign labels. Security rate limiting may process network addresses. We keep application and enquiry records needed to respond to your request separately; refusing analytics does not prevent you from applying or contacting us.</p>
    <p>Google Analytics and Meta advertising pixels are not currently active. We will update this notice and obtain a fresh choice before introducing new optional providers or purposes. You may reject analytics or change your choice at any time using <CookieSettingsLink/>. Rejecting or withdrawing permission stops future optional measurement; it does not remove previously aggregated statistics.</p>
   </section>
   <section id="applications"><h2>Candidate applications and introductions</h2>
    <p>When you apply or register interest, Vorlen may create a candidate record, store your CV securely, record your application and provide a secure candidate portal. Before introducing you to a hirer for a specific vacancy, Vorlen records the relevant job information, checks job-related evidence and confirms the required authority or willingness for that introduction. Joining the database alone does not authorise Vorlen to send your CV to every client.</p>
   </section>

   <section id="ai-recruitment"><h2>AI-assisted recruitment</h2>
    <p>Vorlen may use AI-assisted tools to organise, extract or summarise information and to produce job-related decision-support, such as evidence-based matching or screening suggestions. These tools are not permitted to make solely automated significant recruitment decisions. Material screening decisions and client submissions require meaningful human review.</p>
    <p>You can ask for an explanation of relevant AI-assisted processing, challenge information you believe is inaccurate, request correction and ask for human review through the candidate portal or by contacting <a href="mailto:privacy@vorlen.co.uk">privacy@vorlen.co.uk</a>.</p>
   </section>

   <section id="sharing"><h2>Who we share information with</h2>
    <p>We may share information with hirers where this is necessary for an authorised recruitment introduction; with service providers that host or support Vorlen systems, communications and approved AI functionality; with professional advisers; and with regulators or authorities where required by law. Service providers are required to handle information under appropriate contractual and security controls. Vorlen does not sell candidate personal information.</p>
   </section>

   <section id="transfers"><h2>International transfers</h2>
    <p>If personal information is processed outside the UK, Vorlen will use an applicable UK adequacy regulation or appropriate transfer safeguards and supplementary measures where required. Transfer arrangements are reviewed as part of provider governance.</p>
   </section>

   <section id="retention"><h2>Retention</h2>
    <p>Recruitment records that must be retained under the rules applying to employment agencies are retained for at least the applicable statutory period. Vorlen currently applies a minimum 12-month recruitment-record review period from the last relevant work-finding service, then reviews whether information must be retained longer for an ongoing recruitment relationship, legal claims, accounting or another lawful purpose. Information no longer required is deleted or anonymised where appropriate.</p>
    <p>Suppression records may be retained for as long as necessary to respect an opt-out or do-not-contact request. Security and audit records are retained proportionately to their purpose.</p>
   </section>

   <section id="marketing"><h2>Direct marketing and business development</h2>
    <p>Recruitment-service communications and direct marketing are treated separately. Marketing preferences do not affect a candidate's access to work-finding services. Vorlen honours objections and opt-outs and maintains suppression controls. B2B marketing is carried out subject to UK GDPR and the Privacy and Electronic Communications Regulations, including the different rules that apply to corporate and individual subscribers.</p>
   </section>

   <section id="security"><h2>Security</h2>
    <p>Vorlen uses role-based access controls, tenant isolation, restricted storage, audit records, secure links and other technical and organisational measures designed to prevent unauthorised access, disclosure, alteration or loss. Access to candidate information is limited according to role and recruitment purpose.</p>
   </section>

   <section id="rights"><h2>Your rights</h2>
    <p>Depending on the circumstances, UK data-protection law gives you rights including access, rectification, erasure, restriction, data portability and objection. You also have rights relating to automated decision-making. Some rights are subject to legal exceptions, including where records must be retained by law.</p>
    <p>You may make a privacy request through the secure candidate portal where available or email <a href="mailto:privacy@vorlen.co.uk">privacy@vorlen.co.uk</a>. You can also complain to the Information Commissioner's Office if you are unhappy with how your information has been handled.</p>
   </section>

   <section id="ico"><h2>ICO registration</h2>
    <p>Vorlen Ltd has received confirmation of its Information Commissioner's Office (ICO) data protection fee payment. Its ICO registration reference is <strong>ZC275029</strong>. You can search the <a href="https://ico.org.uk/register" target="_blank" rel="noopener noreferrer">ICO public register</a> using this reference once the register entry has been published.</p>
   </section>

   <section id="changes"><h2>Changes to this notice</h2>
    <p>We version this notice when material processing changes. Application and recruitment records retain the privacy-notice version relevant to the processing event.</p>
   </section>
    <a className="privacy-back-top" href="#privacy-top">Back to top ↑</a>
    </article>
   </div>
  </main>
  <div className="vp-site"><MarketingFooter/></div>
 </div>
}