import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {CONSENT_KEY,CONSENT_EVENT,OPEN_SETTINGS,CONSENT_TTL,isPublicPrivacyPage,readConsent,saveConsent} from '../lib/siteConsent.mjs';
import {resetSiteVisit,trackSitePage} from '../lib/siteAnalytics';
import '../website-privacy.css';

export function CookieSettingsLink(){
 return <button type="button" className="cookie-settings-link" onClick={()=>window.dispatchEvent(new Event(OPEN_SETTINGS))}>Cookie settings</button>;
}
export default function WebsitePrivacy(){
 const location=useLocation();
 const publicPage=isPublicPrivacyPage(location.pathname);
 const [choice,setChoice]=useState(()=>publicPage?readConsent():null);
 const [open,setOpen]=useState(false),[custom,setCustom]=useState(false),[analytics,setAnalytics]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null);
 const returnFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  if(!publicPage){setOpen(false);setCustom(false);resetSiteVisit();return}
  const sync=()=>setChoice(readConsent());
  const storage=(e:StorageEvent)=>{if(e.key===CONSENT_KEY||e.key===null)sync()};
  const settings=()=>{returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setAnalytics(readConsent()?.analytics===true);setCustom(true);setOpen(true)};
  sync();
  window.addEventListener(CONSENT_EVENT,sync);window.addEventListener('storage',storage);window.addEventListener(OPEN_SETTINGS,settings);
  const timer=window.setInterval(sync,60000);
  return()=>{window.removeEventListener(CONSENT_EVENT,sync);window.removeEventListener('storage',storage);window.removeEventListener(OPEN_SETTINGS,settings);window.clearInterval(timer)}
 },[publicPage]);
 useEffect(()=>{
  if(!publicPage)return;
  if(choice?.analytics===true)trackSitePage(location.key);
  else resetSiteVisit();
 },[publicPage,location.key,location.pathname,choice?.analytics,choice?.savedAt]);
 useEffect(()=>{
  if(open&&custom)heading.current?.focus();
 },[open,custom]);
 const finish=(value:boolean)=>{
  setChoice(saveConsent(value));setOpen(false);setCustom(false);
  const el=returnFocus.current;returnFocus.current=null;
  if(el?.isConnected)requestAnimationFrame(()=>el.focus());
 };
 const visible=publicPage&&(!choice||open);
 // Some public pages have no footer; keep a settings control available there too.
 const hasFooter=location.pathname==='/'||location.pathname==='/about'||location.pathname==='/careers'||
  /^\/(services|sectors|locations|guides|tools)\//.test(location.pathname)||
  ['/employers','/our-approach','/candidates','/partners'].includes(location.pathname);
 if(!publicPage)return null;
 if(!visible)return hasFooter?null:<div className="cookie-settings-floating"><CookieSettingsLink/></div>;
 return <section className="website-privacy" aria-labelledby="website-privacy-heading">
  <div className="website-privacy-inner">
   <div className="website-privacy-copy">
    <h2 ref={heading} tabIndex={-1} id="website-privacy-heading">{custom?'Privacy preferences':'Your privacy matters'}</h2>
    <p>We use essential technology to keep Vorlen working. With your permission, we measure visits, traffic sources and recruitment conversions using first-party analytics. Optional analytics are off until you agree.</p>
    {custom&&<div className="website-privacy-options">
      <div><strong>Essential</strong><span>Always active — security, requested services and your privacy choice.</span></div>
      <label><span><strong>Analytics</strong><span>Measure site and campaign activity. No advertising pixels are active.</span></span><input type="checkbox" checked={analytics} onChange={e=>setAnalytics(e.target.checked)}/></label>
      <p>Your choice is saved on this browser for {Math.round(CONSENT_TTL/86400000)} days. You can change it at any time.</p>
    </div>}
    <div className="website-privacy-links"><Link to="/privacy#cookies">Cookie policy</Link>{!custom&&<button type="button" onClick={()=>{setAnalytics(false);setCustom(true);setOpen(true)}}>Manage preferences</button>}</div>
   </div>
   <div className="website-privacy-actions">
    <button type="button" onClick={()=>finish(false)}>Reject optional</button>
    <button type="button" onClick={()=>finish(true)}>Accept all</button>
    {custom&&<button type="button" className="website-privacy-save" onClick={()=>finish(analytics)}>Save preferences</button>}
   </div>
  </div>
 </section>
}
