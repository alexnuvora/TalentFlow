import {useEffect,useRef} from 'react';

type Props={value:string;onChange:(html:string)=>void;disabled?:boolean;ariaLabel?:string};

const hasMarkup=(value:string)=>/<[a-z][\s\S]*>/i.test(value);
const escapeHtml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const normalise=(value:string)=>hasMarkup(value)?value:escapeHtml(value).replace(/\n/g,'<br>');
export const richTextHasContent=(value:string)=>String(value||'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&[a-z0-9#]+;/gi,'x').trim().length>0;

export default function RichTextEditor({value,onChange,disabled=false,ariaLabel='Message'}:Props){
 const ref=useRef<HTMLDivElement>(null);
 const editing=useRef(false);
 const lastEmitted=useRef('');
 const initialised=useRef(false);

 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const next=normalise(value);
  if(editing.current&&value===lastEmitted.current)return;
  if(!initialised.current||el.innerHTML!==next){el.innerHTML=next;initialised.current=true}
 },[value]);

 const emit=()=>{const html=ref.current?.innerHTML||'';lastEmitted.current=html;onChange(html)};
 const run=(command:string,arg?:string)=>{if(disabled)return;ref.current?.focus();document.execCommand(command,false,arg);emit()};
 const link=()=>{const href=window.prompt('Link URL (https:// or mailto:)');if(!href)return;if(!/^(https?:\/\/|mailto:)/i.test(href)){window.alert('Use an https://, http:// or mailto: link.');return}run('createLink',href)};

 return <div className="rich-email-editor">
  <div className="rich-email-toolbar" role="toolbar" aria-label="Message formatting">
   <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>run('bold')} aria-label="Bold"><strong>B</strong></button>
   <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>run('italic')} aria-label="Italic"><em>I</em></button>
   <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>run('underline')} aria-label="Underline"><u>U</u></button>
   <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>run('insertUnorderedList')} aria-label="Bulleted list">• List</button>
   <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>run('insertOrderedList')} aria-label="Numbered list">1. List</button>
   <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={link} aria-label="Insert link">Link</button>
   <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>run('removeFormat')} aria-label="Clear formatting">Clear</button>
  </div>
  <div ref={ref} className="rich-email-input" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={ariaLabel}
   onFocus={()=>{editing.current=true}}
   onInput={()=>emit()}
   onPaste={e=>{e.preventDefault();const text=e.clipboardData.getData('text/plain');document.execCommand('insertText',false,text);emit()}}
   onBlur={()=>{emit();editing.current=false}}/>
 </div>
}
