import type { ReactNode } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
export function Button({children,onClick,type='button',variant='primary',disabled=false}:{children:ReactNode;onClick?:()=>void;type?:'button'|'submit';variant?:'primary'|'ghost'|'danger';disabled?:boolean}){return <button type={type} disabled={disabled} onClick={onClick} className={`btn ${variant} ${disabled?'disabled':''}`}>{children}</button>}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'green'|'amber'|'red'|'blue'}){return <span className={`badge ${tone}`}>{children}</span>}
export function Card({children,className='' }:{children:ReactNode;className?:string}){return <section className={`card ${className}`}>{children}</section>}
export function Empty({title,text}:{title:string;text:string}){return <div className="empty"><div className="empty-icon">○</div><h3>{title}</h3><p>{text}</p></div>}
export function Spinner(){return <LoaderCircle className="spin" size={20}/>}
export function SearchBox({value,onChange,placeholder='Search…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <label className="search"><Search size={17}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>}
