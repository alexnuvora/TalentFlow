import {useEffect,useRef} from 'react';

type Props={value:string;onChange:(html:string)=>void;disabled?:boolean;ariaLabel?:string};

const hasMarkup=(value:string)=>/<[a-z][\s\S]*>/i.test(value);
const escapeHtml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const normalise=(value:string)=>hasMarkup(value)?value:escapeHtml(value).replace(/\n/g,'<br>');

export default function RichTextEditor({value,onChange,disabled=false,ariaLabel='Message'}:Props){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(ref.current&&ref.current.innerHTML!==normalise(value))ref.current.innerHTML=normalise(value)},[value]);
 const run=(command:string,arg?:string)=>{if(disabled)return;ref.current?.focus();document.execCommand(command,false,arg);onChange(ref.current?.innerHTML||'')};
 const link=()=>{const href=window.prompt('Link URL (https:// or mailto:)');if(!href)return;if(!/^(https?:\/\/|mailto:)/i.test(href)){window.alert('Use an https://, http:// or mailto: link.');return}run('createLink',href)};
 return <div className="rich-email-editor">
  <div className="rich-email-toolbar" role="toolbar" aria-label="Message formatting">
   <button type="button" disabled={disabled} onClick={()=>run('bold')} aria-label="Bold"><strong>B</strong></button>
   <button type="button" disabled={disabled} onClick={()=>run('italic')} aria-label="Italic"><em>I</em></button>
   <button type="button" disabled={disabled} onClick={()=>run('underline')} aria-label="Underline"><u>U</u></button>
   <button type="button" disabled={disabled} onClick={()=>run('insertUnorderedList')} aria-label="Bulleted list">• List</button>
   <button type="button" disabled={disabled} onClick={()=>run('insertOrderedList')} aria-label="Numbered list">1. List</button>
   <button type="button" disabled={disabled} onClick={link} aria-label="Insert link">Link</button>
   <button type="button" disabled={disabled} onClick={()=>run('removeFormat')} aria-label="Clear formatting">Clear</button>
  </div>
  <div ref={ref} className="rich-email-input" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={ariaLabel} onInput={e=>onChange(e.currentTarget.innerHTML)} onBlur={e=>onChange(e.currentTarget.innerHTML)}/>
 </div>
}
