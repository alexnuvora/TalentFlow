import {useEffect,useMemo,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {ArrowLeft,Briefcase,FileText,MapPin,Printer,ShieldCheck} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {Button,SkeletonCards} from '../components/Ui';
import {noIndex,setSeo} from '../lib/seo';

const SECTION_NAMES=new Set([
  'PROFESSIONAL PROFILE','PROFILE','SUMMARY','PERSONAL PROFILE','CORE SKILLS','KEY SKILLS','SKILLS',
  'PROFESSIONAL EXPERIENCE','WORK EXPERIENCE','EMPLOYMENT HISTORY','EXPERIENCE','CAREER HISTORY',
  'EDUCATION','EDUCATION & QUALIFICATIONS','QUALIFICATIONS','TRAINING & QUALIFICATIONS','TRAINING',
  'ADDITIONAL INFORMATION','ADDITIONAL DETAILS','CERTIFICATIONS','CERTIFICATES','REFERENCES'
]);

function normaliseHeading(value:string){
  return value.trim().replace(/[:\-–—]+$/,'').replace(/\s+/g,' ').toUpperCase();
}
function looksLikeHeading(value:string){
  const clean=normaliseHeading(value);
  if(SECTION_NAMES.has(clean))return true;
  const letters=clean.replace(/[^A-Z]/g,'');
  return clean.length>2&&clean.length<52&&letters.length>2&&clean===value.trim().toUpperCase()&&!/[.!?]$/.test(value);
}
function looksLikeRoleLine(value:string){
  return /\|/.test(value)&&(/\b(19|20)\d{2}\b|present|current/i.test(value));
}
function splitSections(text:string,candidateName:string){
  const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
  let headline='';
  const body=[...lines];
  if(body.length&&normaliseHeading(body[0])===normaliseHeading(candidateName))body.shift();
  if(body.length&&!looksLikeHeading(body[0])&&!body[0].includes('[phone withheld')&&!body[0].includes('[email withheld'))headline=body.shift()||'';
  if(body.length&&(/withheld by Vorlen/i.test(body[0])||/Manchester, United Kingdom/i.test(body[0])))body.shift();

  const sections:{title:string;lines:string[]}[]=[];
  let current={title:'PROFILE',lines:[] as string[]};
  for(const line of body){
    if(looksLikeHeading(line)){
      if(current.lines.length)sections.push(current);
      current={title:normaliseHeading(line),lines:[]};
    }else current.lines.push(line);
  }
  if(current.lines.length)sections.push(current);
  return {headline,sections};
}

function SectionContent({title,lines}:{title:string;lines:string[]}){
  const skills=/SKILLS|ADDITIONAL INFORMATION|ADDITIONAL DETAILS|CERTIFICATIONS/.test(title);
  const experience=/EXPERIENCE|EMPLOYMENT|CAREER HISTORY/.test(title);
  if(skills)return <ul className="safe-cv-skill-list">{lines.map((line,i)=><li key={i}>{line}</li>)}</ul>;
  if(experience){
    const groups:{heading?:string;items:string[]}[]=[];let group:{heading?:string;items:string[]}={items:[]};
    for(const line of lines){
      if(looksLikeRoleLine(line)){
        if(group.heading||group.items.length)groups.push(group);
        group={heading:line,items:[]};
      }else group.items.push(line);
    }
    if(group.heading||group.items.length)groups.push(group);
    return <div className="safe-cv-history">{groups.map((g,i)=><div className="safe-cv-role" key={i}>{g.heading&&<h3>{g.heading}</h3>}{g.items.length>0&&<ul>{g.items.map((x,j)=><li key={j}>{x}</li>)}</ul>}</div>)}</div>;
  }
  if(/EDUCATION|QUALIFICATIONS|TRAINING/.test(title))return <div className="safe-cv-education">{lines.map((line,i)=><div key={i}>{line}</div>)}</div>;
  return <div className="safe-cv-copy">{lines.map((line,i)=><p key={i}>{line}</p>)}</div>;
}

export default function ClientSafeCv(){
  const nav=useNavigate(),{submissionId=''}=useParams();
  const[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(){
    setLoading(true);setError('');
    const{data:d,error:e}=await supabase.functions.invoke('client-candidate-cv',{body:{submission_id:submissionId}});
    if(e||d?.error){setData(null);setError(d?.error||e?.message||'Client-safe CV could not be opened.')}else setData(d);
    setLoading(false);
  }
  useEffect(()=>{setSeo({title:'Client-safe CV | Vorlen',description:'Secure client-safe candidate CV.',path:'/client/cv',robots:noIndex});void load()},[submissionId]);
  const parsed=useMemo(()=>data?splitSections(data.text||'',data.candidate_name||'Candidate'):{headline:'',sections:[]},[data]);
  if(loading)return <div className="client-surface"><SkeletonCards count={2}/></div>;
  if(error||!data)return <div className="client-surface"><main className="candidate-simple"><div className="marketing-brand"><span>V</span><strong>Vorlen</strong></div><h1>We couldn't open this CV.</h1><p>{error}</p><Button onClick={()=>nav('/client')}>Back to client workspace</Button></main></div>;

  return <div className="client-surface safe-cv-page">
    <header className="client-header safe-cv-shell-header">
      <div className="marketing-brand"><span>V</span><strong>Vorlen Client-Safe CV</strong></div>
      <div className="safe-cv-header-status"><ShieldCheck size={16}/><span>Protected introduction</span></div>
    </header>
    <main className="safe-cv-main">
      <div className="safe-cv-toolbar">
        <Button variant="ghost" onClick={()=>nav('/client')}><ArrowLeft size={14}/> Back to client workspace</Button>
        <Button variant="ghost" onClick={()=>window.print()}><Printer size={14}/> Print / save PDF</Button>
      </div>

      <article className="safe-cv-document">
        <div className="safe-cv-accent"/>
        <header className="safe-cv-document-header">
          <div className="safe-cv-title-block">
            <div className="safe-cv-kicker"><FileText size={14}/> Candidate CV</div>
            <h1>{data.candidate_name}</h1>
            {parsed.headline&&<p className="safe-cv-headline"><Briefcase size={15}/>{parsed.headline}</p>}
            <p className="safe-cv-location"><MapPin size={14}/> Location shared through Vorlen</p>
          </div>
          <div className="safe-cv-vorlen-mark"><span>V</span><small>VORLEN</small></div>
        </header>

        <div className="safe-cv-protection">
          <ShieldCheck size={18}/>
          <div><strong>Client-safe candidate document</strong><p>Direct email, phone, postal address and personal profile links have been withheld. Please coordinate all candidate contact through Vorlen.</p></div>
        </div>

        <div className="safe-cv-sections">
          {parsed.sections.map((section,i)=><section className="safe-cv-section" key={section.title+i}>
            <div className="safe-cv-section-heading"><span>{String(i+1).padStart(2,'0')}</span><h2>{section.title.replaceAll('&','&')}</h2></div>
            <SectionContent title={section.title} lines={section.lines}/>
          </section>)}
        </div>

        <footer className="safe-cv-footer">
          <div><strong>Vorlen</strong><span>Confidential candidate introduction</span></div>
          <p>This document is provided solely for recruitment assessment in connection with the relevant Vorlen introduction.</p>
        </footer>
      </article>
    </main>
  </div>
}
