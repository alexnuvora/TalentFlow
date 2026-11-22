import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Menu,X} from 'lucide-react';
import VorlenBrand from './VorlenBrand';

export default function MarketingHeader(){
  const [overHero,setOverHero]=useState(true);
  const [menuOpen,setMenuOpen]=useState(false);
  const location=useLocation();
  useEffect(()=>{setMenuOpen(false)},[location.pathname]);
  useEffect(()=>{
    const update=()=>{
      const hero=document.querySelector<HTMLElement>('.vp-hero, .about-hero');
      setOverHero(Boolean(hero&&hero.getBoundingClientRect().bottom>86&&hero.getBoundingClientRect().top<86));
    };
    update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
    return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update)};
  },[location.pathname]);
  useEffect(()=>{
    if(!menuOpen)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenuOpen(false)};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[menuOpen]);
  const links=[['/employers','Employers'],['/services/permanent-recruitment','Services'],['/careers','Careers'],['/about','About us'],['/partners','Partners']];
  return <header className={`vp-nav vp-nav-overlay ${overHero&&!menuOpen?'vp-nav-on-hero':'vp-nav-on-light'} ${menuOpen?'vp-menu-open':''}`}>
    <VorlenBrand/>
    <nav className="vp-desktop-links" aria-label="Primary navigation">{links.map(([to,label])=><Link key={to} to={to}>{label}</Link>)}</nav>
    <div className="vp-nav-actions"><Link className="vp-signin" to="/login">Sign in</Link><Link className="vp-btn vp-btn-small" to="/contact?reason=employer">Discuss a vacancy</Link></div>
    <button type="button" className="vp-menu-toggle" aria-label={menuOpen?'Close menu':'Open menu'} aria-controls="vp-mobile-menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={25}/>:<Menu size={25}/>}</button>
    <nav id="vp-mobile-menu" className="vp-mobile-menu" aria-label="Mobile navigation" hidden={!menuOpen}>{links.map(([to,label])=><Link key={to} to={to} onClick={()=>setMenuOpen(false)}>{label}</Link>)}<Link to="/login" onClick={()=>setMenuOpen(false)}>Sign in</Link><Link className="vp-mobile-cta" to="/contact?reason=employer" onClick={()=>setMenuOpen(false)}>Discuss a vacancy</Link></nav>
  </header>;
}
