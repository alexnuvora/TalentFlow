import {Link} from 'react-router-dom';
import {Facebook,Linkedin,Building2} from 'lucide-react';
import VorlenBrand from './VorlenBrand';
import DirectoryVerificationBadge from './DirectoryVerificationBadge';
import GooglePreferredSource from './GooglePreferredSource';
import {CookieSettingsLink} from './WebsitePrivacy';

export default function MarketingFooter(){return <footer className="vp-footer">
      <div className="vp-footer-brand"><VorlenBrand/><p>Good recruitment starts with a conversation.</p><div className="vp-footer-socials" aria-label="Vorlen social media"><a href="https://www.facebook.com/share/19pqmJPH3v/" target="_blank" rel="noopener noreferrer" aria-label="Vorlen on Facebook"><Facebook size={18}/></a><a href="https://www.linkedin.com/company/vorlen/" target="_blank" rel="noopener noreferrer" aria-label="Vorlen on LinkedIn"><Linkedin size={18}/></a><a className="vp-companies-house-link" href="https://find-and-update.company-information.service.gov.uk/company/17387520" target="_blank" rel="noopener noreferrer" aria-label="View Vorlen Ltd on Companies House"><Building2 size={20} aria-hidden="true"/><span>Companies House</span></a></div><DirectoryVerificationBadge/><div className="google-preferred-source"><GooglePreferredSource/></div></div>
      <div><strong>Employers</strong><Link to="/employers">For employers</Link><Link to="/services/permanent-recruitment">Permanent recruitment</Link><Link to="/services/candidate-sourcing">Candidate sourcing</Link><Link to="/services/recruitment-for-smes">Recruitment for SMEs</Link></div>
      <div><strong>Candidates</strong><Link to="/candidates">For candidates</Link><Link to="/careers">Open opportunities</Link><Link to="/candidate-terms">Candidate terms</Link><Link to="/privacy">Privacy policy</Link></div>
      <div><strong>Vorlen</strong><Link to="/about">About us</Link><Link to="/partners">Partner network</Link><Link to="/locations/manchester">Manchester</Link><Link to="/locations/greater-manchester">Greater Manchester</Link><Link to="/contact">Contact</Link><Link to="/accessibility">Accessibility</Link><Link to="/privacy#cookies">Cookie policy</Link><CookieSettingsLink/></div>
      <div className="vp-footer-base"><span>© {new Date().getFullYear()} Vorlen</span><span>Vorlen Ltd · Company No. 17387520 · Registered in England and Wales · Registered office: Piccadilly Business Centre, Unit C Aldow Enterprise Park, Blackett Street, Manchester, M12 6AE · ICO Ref: ZC275029</span></div>
    </footer>;}
