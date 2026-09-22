import {Link} from 'react-router-dom';

export function VorlenMark({className=''}:{className?:string}){
  return <svg className={`vorlen-mark ${className}`.trim()} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path className="vorlen-mark-primary" d="M5 7h9.3L24 30.7 33.7 7H43L28.2 41h-8.4z"/>
    <path className="vorlen-mark-accent" d="M24 30.7 28.2 41h-8.4z"/>
  </svg>
}

export default function VorlenBrand({to='/',compact=false,className=''}:{to?:string;compact?:boolean;className?:string}){
  return <Link to={to} className={`vorlen-brand ${compact?'compact':''} ${className}`.trim()} aria-label="Vorlen home">
    <VorlenMark/>
    <span className="vorlen-wordmark">VORLEN</span>
  </Link>
}
