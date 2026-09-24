import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Card,Button,Badge,SkeletonRows,useToast} from '../components/Ui';
import {supabase} from '../lib/supabase';

const fields=[
 ['legal_name','Legal name',true],['trading_name','Trading / business name',false],['country','Country',true],
 ['address','Address',true],['phone','Phone',true],['business_type','Business type',false],
 ['company_registration_number','Company registration number',false],['vat_number','VAT number',false],
 ['tax_reference','Tax reference',false],['payment_method','Payment method',true],
 ['payment_account_name','Payment account / payee name',false],['payment_currency','Payment currency',false],
 ['payment_details_reference','Payment reference',false]
] as const;

export default function PartnerOnboarding(){
 const toast=useToast();
 const[loading,setLoading]=useState(true),[onb,setOnb]=useState<any>(null),[agreement,setAgreement]=useState<any>(null);
 const[form,setForm]=useState<any>({legal_name:'',trading_name:'',country:'',address:'',phone:'',business_type:'',company_registration_number:'',vat_number:'',tax_reference:'',payment_method:'',payment_account_name:'',payment_currency:'GBP',payment_details_reference:''});
 const[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');

 async function load(){
  setLoading(true);setError('');
  const{data:{user},error:ue}=await supabase.auth.getUser();
  if(ue||!user){setError(ue?.message||'Your session has expired.');setLoading(false);return}
  const[{data:o,error:oe},{data:a,error:ae}]=await Promise.all([
   supabase.from('partner_onboarding').select('*').eq('partner_id',user.id).maybeSingle(),
   supabase.from('partner_agreements').select('*').eq('partner_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  if(oe||ae)setError(oe?.message||ae?.message||'Partner onboarding could not be loaded.');
  setOnb(o);setAgreement(a);
  if(o)setForm((x:any)=>({...x,...Object.fromEntries(Object.keys(x).map(k=>[k,o[k]??x[k]??'']))}));
  setLoading(false);
 }
 useEffect(()=>{void load()},[]);

 async function accept(){
  if(!agreement||!name.trim())return;
  setBusy(true);setError('');
  const{error:e}=await supabase.rpc('accept_partner_agreement',{p_agreement:agreement.id,p_accepted_name:name.trim(),p_user_agent:navigator.userAgent});
  setBusy(false);if(e)return setError(e.message);
  toast('Partner agreement accepted. Complete your partner details next.');await load();
 }

 async function details(e:any){
  e.preventDefault();if(!onb||!['details_pending','review_pending'].includes(onb.status))return;
  setBusy(true);setError('');
  const payload={...form,payment_currency:String(form.payment_currency||'GBP').trim().toUpperCase(),status:'review_pending',updated_at:new Date().toISOString()};
  const{error:er}=await supabase.from('partner_onboarding').update(payload).eq('partner_id',onb.partner_id);
  setBusy(false);if(er)return setError(er.message);
  toast(onb.status==='review_pending'?'Submitted partner details updated.':'Details submitted for Vorlen activation review.');await load();
 }

 if(loading)return <div className="page"><SkeletonRows rows={6}/></div>;
 if(!onb)return <div className="page"><Card><h2>Partner onboarding</h2><p>Your Vorlen partner record has not been initialised. Ask a workspace owner or manager to resend or initialise your partner invitation.</p><Link className="btn ghost" to="/contact">Contact Vorlen</Link></Card></div>;

 const status=String(onb.status||'terms_pending');
 const accepted=agreement?.status==='accepted';
 const tone=status==='active'?'green':status==='terminated'?'red':'amber';

 return <div className="page partner-page">
  <div className="page-actions"><div><div className="eyebrow">VORLEN PARTNER NETWORK</div><h2>Partner onboarding</h2><p>Agreement, operating details and Vorlen approval must be complete before operational access is enabled.</p></div><Badge tone={tone as any}>{status.replaceAll('_',' ')}</Badge></div>
  <div className="notice"><strong>Commercial authority:</strong> You may develop employer relationships and gather hiring requirements only where your assigned partner specialism permits it. Only authorised Vorlen managers can approve fees, payment terms, rebates, guarantees, exclusivity, candidate ownership or other binding client terms.</div>
  {error&&<div className="notice error">{error}</div>}

  {status==='suspended'&&<Card><h3>Partner access suspended</h3><p>Your operational workspace is paused. Existing records remain preserved, but you cannot carry out partner activity until Vorlen management reactivates the relationship.</p><div className="button-row"><Link className="btn ghost" to="/dashboard/partner/profile">View profile & agreement</Link><Link className="btn ghost" to="/contact">Contact Vorlen</Link></div></Card>}
  {status==='terminated'&&<Card><h3>Partner relationship ended</h3><p>Your operational partner access has ended. Historical agreement and account information remain available from your Profile, but no new client, candidate or commercial activity can be created.</p><div className="button-row"><Link className="btn ghost" to="/dashboard/partner/profile">View profile & agreement</Link><Link className="btn ghost" to="/contact">Contact Vorlen</Link></div></Card>}

  {!['suspended','terminated'].includes(status)&&!accepted&&<Card><div className="eyebrow">STEP 1 OF 3</div><h3>Review and accept the partner agreement</h3><p className="muted">Acceptance records the exact agreement version and terms hash against your account.</p><pre className="answer-box">{agreement?.terms_text||'Your agreement is being prepared by Vorlen.'}</pre>{agreement&&<><label>Type your full legal name to accept<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label><Button disabled={busy||!name.trim()} onClick={accept}>Accept partner agreement</Button></>}</Card>}

  {!['suspended','terminated','active'].includes(status)&&accepted&&['details_pending','review_pending'].includes(status)&&<Card>
   <div className="eyebrow">STEP 2 OF 3</div><h3>{status==='review_pending'?'Partner details submitted':'Complete your partner details'}</h3>
   <p className="muted">{status==='review_pending'?'Vorlen is reviewing these details. You can correct them while review is pending.':'These details support partner administration and commission payments.'} Do not enter passwords, card PINs or online-banking credentials.</p>
   <form className="form-grid" onSubmit={details}>{fields.map(([key,label,required])=><label className={key==='address'?'full':''} key={key}>{label}<input required={required} value={form[key]||''} maxLength={key==='payment_currency'?3:undefined} onChange={e=>setForm({...form,[key]:key==='payment_currency'?e.target.value.toUpperCase():e.target.value})}/></label>)}<Button disabled={busy} type="submit">{status==='review_pending'?'Update submitted details':'Submit for activation review'}</Button></form>
  </Card>}

  {status==='review_pending'&&<Card><div className="eyebrow">STEP 3 OF 3</div><h3>Awaiting Vorlen approval</h3><p>Your agreement is accepted and your details have been submitted. A Vorlen manager must review and activate the partner account before operational screens become available.</p><Badge tone="amber">Manager review pending</Badge></Card>}

  {status==='active'&&<Card><div className="eyebrow">ONBOARDING COMPLETE</div><h3>Your partner workspace is active</h3><p>Your accepted agreement and onboarding review are complete. Your available screens and actions are now determined by the partner specialism assigned by Vorlen.</p><div className="button-row"><Link className="btn" to="/dashboard/partner">Open partner workspace</Link><Link className="btn ghost" to="/dashboard/partner/profile">View profile & agreement</Link><Link className="btn ghost" to="/dashboard/partner/earnings">Placements & earnings</Link></div></Card>}

  {agreement&&<Card><h3>Agreement record</h3><div className="list-row"><div><strong>{agreement.version}</strong><span>{accepted&&agreement.accepted_at?'Accepted '+new Date(agreement.accepted_at).toLocaleString('en-GB'):'Awaiting acceptance'}</span></div><Badge tone={accepted?'green':'amber'}>{agreement.status}</Badge></div></Card>}
 </div>
}
