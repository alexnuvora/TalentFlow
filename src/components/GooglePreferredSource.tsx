import {useEffect,useRef,useState} from 'react';

type PreferredSourceClient={init:(options:{theme:'light'|'dark';lang?:string})=>void;addPreferredSource:()=>void};
declare global{interface Window{PREFERRED_SOURCE?:Array<(client:PreferredSourceClient)=>void>}}

export default function GooglePreferredSource(){
  const client=useRef<PreferredSourceClient|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    window.PREFERRED_SOURCE=window.PREFERRED_SOURCE||[];
    window.PREFERRED_SOURCE.push((preferredSource)=>{
      preferredSource.init({theme:'light',lang:'en'});
      client.current=preferredSource;
      setReady(true);
    });
    return()=>{client.current=null};
  },[]);
  return <button type="button" className="google-preferred-source-btn" disabled={!ready} onClick={()=>client.current?.addPreferredSource()} aria-label="Add Vorlen to your preferred sources on Google">
    <span className="google-g" aria-hidden="true">G</span><span>{ready?'Add Vorlen to preferred sources':'Loading Google…'}</span>
  </button>
}
