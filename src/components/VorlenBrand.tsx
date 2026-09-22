import {Link} from 'react-router-dom';

export function VorlenMark({className=''}:{className?:string}){
  return <span className={`vorlen-mark ${className}`.trim()} aria-hidden="true"><span className="vorlen-mark-left"/><span className="vorlen-mark-right"/></span>
}

export default function VorlenBrand({to='/',compact=false,className=''}:{to?:string;compact?:boolean;className?:string}){
  return <Link to={to} className={`vorlen-brand ${compact?'compact':''} ${className}`.trim()} aria-label="Vorlen home">
    <VorlenMark/>
    <span className="vorlen-wordmark">VORLEN</span>
  </Link>
}
