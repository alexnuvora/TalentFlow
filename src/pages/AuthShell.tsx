import {Link} from 'react-router-dom';
import VorlenBrand from '../components/VorlenBrand';

export default function AuthShell({eyebrow,title,copy,children,footer}:{eyebrow:string;title:string;copy:string;children:React.ReactNode;footer?:React.ReactNode}){
  return <div className="customer-auth vorlen-auth">
    <aside className="auth-story">
      <VorlenBrand className="auth-logo"/>
      <div className="auth-story-copy">
        <small>{eyebrow}</small>
        <h2>Recruitment, properly connected.</h2>
        <p>One secure workspace for client relationships, vacancies, candidate review, interviews, placements and the commercial work around them.</p>
      </div>
      <div className="auth-proof">
        <div><strong>Clear briefs</strong><span>before delivery starts</span></div>
        <div><strong>Human review</strong><span>before candidate introductions</span></div>
        <div><strong>Connected records</strong><span>from vacancy to placement</span></div>
      </div>
    </aside>
    <main className="auth-panel">
      <div className="auth-panel-inner">
        <Link to="/" className="auth-back">← Back to Vorlen</Link>
        <div className="auth-heading"><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></div>
        {children}
        {footer&&<div className="auth-footer-copy">{footer}</div>}
      </div>
    </main>
  </div>
}