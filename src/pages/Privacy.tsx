import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {setSeo} from '../lib/seo';
import VorlenBrand from '../components/VorlenBrand';

export default function Privacy(){
 useEffect(()=>setSeo({
  title:'Privacy notice | Vorlen',
  description:'How Ivy and Pearls Ltd trading as Vorlen handles personal information for recruitment, client development, partner operations and website enquiries.',
  path:'/privacy'
 }),[]);
 return <div className="legal-public">
  <header><VorlenBrand/><Link to="/contact">Contact</Link></header>
  <main>
   <div className="legal-kicker">PRIVACY NOTICE · VERSION 25 SEPTEMBER 2026</div>
   <h1>Privacy notice</h1>
   <p className="legal-lead">This notice explains how Ivy and Pearls Ltd, trading as Vorlen, uses personal information when providing permanent recruitment services, operating its partner and client workspaces, developing business relationships and responding to enquiries.</p>

   <section><h2>Who is responsible for your information</h2>
    <p><strong>Ivy and Pearls Ltd</strong>, company number <strong>17387520</strong>, registered in England and Wales with registered office at <strong>10 South Street, Rochdale, United Kingdom, OL16 2EP</strong>, trading as <strong>Vorlen</strong>, is the controller for the personal information described in this notice unless another organisation is clearly identified as the controller for a particular activity.</p>
    <p>Privacy enquiries can be sent to <a href="mailto:privacy@vorlen.co.uk">privacy@vorlen.co.uk</a>.</p>
   </section>

   <section><h2>Our staged operating model</h2>
    <p>Vorlen uses technical compliance gates before candidate-processing features can operate. Candidate applications, sourcing, screening and introductions are available only when the relevant workspace compliance controls are active. If you apply for a role, register interest, use a secure candidate portal or otherwise ask Vorlen to provide work-finding services, the candidate sections of this notice apply to that processing.</p>
   </section>

   <section><h2>Information we may collect</h2>
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

   <section><h2>Where information comes from</h2>
    <p>Information may come directly from you; from a hirer or prospective hirer; from a Vorlen partner acting within an authorised role; from recruitment activity you have participated in; or, where lawful and appropriate, from professional or publicly available business sources. If Vorlen obtains personal information indirectly, we provide the required privacy information within the applicable UK GDPR timeframe unless an exemption applies.</p>
   </section>

   <section><h2>Why we use information and our lawful bases</h2>
    <p>We use personal information only where we have a lawful basis. The basis depends on the activity:</p>
    <ul>
     <li><strong>Steps at your request before a contract / provision of work-finding services:</strong> receiving applications, registering interest and taking recruitment steps you ask us to take.</li>
     <li><strong>Legitimate interests:</strong> operating a recruitment business, managing client and partner relationships, keeping accurate recruitment records, service improvement, security, fraud prevention and proportionate B2B business development. We assess whether those interests are overridden by individual rights.</li>
     <li><strong>Legal obligation:</strong> records and checks that recruitment agencies must maintain or obtain, and other applicable legal, tax, accounting or regulatory requirements.</li>
     <li><strong>Consent:</strong> only where the law requires consent or where we choose consent as the appropriate basis, for example certain marketing or optional processing. Consent is kept separate from access to core work-finding services and can be withdrawn.</li>
    </ul>
    <p>A privacy acknowledgement in an application confirms that you have seen this notice; it is not used to convert processing that relies on contract steps, legal obligation or legitimate interests into consent-based processing.</p>
   </section>

   <section><h2>Candidate applications and introductions</h2>
    <p>When you apply or register interest, Vorlen may create a candidate record, store your CV securely, record your application and provide a secure candidate portal. Before introducing you to a hirer for a specific vacancy, Vorlen records the relevant job information, checks job-related evidence and confirms the required authority or willingness for that introduction. Joining the database alone does not authorise Vorlen to send your CV to every client.</p>
   </section>

   <section><h2>AI-assisted recruitment</h2>
    <p>Vorlen may use AI-assisted tools to organise, extract or summarise information and to produce job-related decision-support, such as evidence-based matching or screening suggestions. These tools are not permitted to make solely automated significant recruitment decisions. Material screening decisions and client submissions require meaningful human review.</p>
    <p>You can ask for an explanation of relevant AI-assisted processing, challenge information you believe is inaccurate, request correction and ask for human review through the candidate portal or by contacting <a href="mailto:privacy@vorlen.co.uk">privacy@vorlen.co.uk</a>.</p>
   </section>

   <section><h2>Who we share information with</h2>
    <p>We may share information with hirers where this is necessary for an authorised recruitment introduction; with service providers that host or support Vorlen systems, communications and approved AI functionality; with professional advisers; and with regulators or authorities where required by law. Service providers are required to handle information under appropriate contractual and security controls. Vorlen does not sell candidate personal information.</p>
   </section>

   <section><h2>International transfers</h2>
    <p>If personal information is processed outside the UK, Vorlen will use an applicable UK adequacy regulation or appropriate transfer safeguards and supplementary measures where required. Transfer arrangements are reviewed as part of provider governance.</p>
   </section>

   <section><h2>Retention</h2>
    <p>Recruitment records that must be retained under the rules applying to employment agencies are retained for at least the applicable statutory period. Vorlen currently applies a minimum 12-month recruitment-record review period from the last relevant work-finding service, then reviews whether information must be retained longer for an ongoing recruitment relationship, legal claims, accounting or another lawful purpose. Information no longer required is deleted or anonymised where appropriate.</p>
    <p>Suppression records may be retained for as long as necessary to respect an opt-out or do-not-contact request. Security and audit records are retained proportionately to their purpose.</p>
   </section>

   <section><h2>Direct marketing and business development</h2>
    <p>Recruitment-service communications and direct marketing are treated separately. Marketing preferences do not affect a candidate's access to work-finding services. Vorlen honours objections and opt-outs and maintains suppression controls. B2B marketing is carried out subject to UK GDPR and the Privacy and Electronic Communications Regulations, including the different rules that apply to corporate and individual subscribers.</p>
   </section>

   <section><h2>Security</h2>
    <p>Vorlen uses role-based access controls, tenant isolation, restricted storage, audit records, secure links and other technical and organisational measures designed to prevent unauthorised access, disclosure, alteration or loss. Access to candidate information is limited according to role and recruitment purpose.</p>
   </section>

   <section><h2>Your rights</h2>
    <p>Depending on the circumstances, UK data-protection law gives you rights including access, rectification, erasure, restriction, data portability and objection. You also have rights relating to automated decision-making. Some rights are subject to legal exceptions, including where records must be retained by law.</p>
    <p>You may make a privacy request through the secure candidate portal where available or email <a href="mailto:privacy@vorlen.co.uk">privacy@vorlen.co.uk</a>. You can also complain to the Information Commissioner's Office if you are unhappy with how your information has been handled.</p>
   </section>

   <section><h2>ICO data-protection fee position</h2>
    <p>Vorlen's current company record reflects a pre-trading ICO data-protection-fee assessment. That position is not treated as permanent: the assessment is configured to be revisited when trading commences and whenever the organisation's processing circumstances change.</p>
   </section>

   <section><h2>Changes to this notice</h2>
    <p>We version this notice when material processing changes. Application and recruitment records retain the privacy-notice version relevant to the processing event.</p>
   </section>
  </main>
 </div>
}