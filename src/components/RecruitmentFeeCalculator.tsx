import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight} from 'lucide-react';
import {calculateRecruitmentFees,STANDARD_RATE,MAX_SALARY,MAX_RATE} from '../lib/recruitmentFees.mjs';
import '../recruitment-fee-calculator.css';

const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n);
export default function RecruitmentFeeCalculator(){
 const [salary,setSalary]=useState('40000'),[comparison,setComparison]=useState('20');
 const estimate=calculateRecruitmentFees(salary,comparison);
 const salaryValid=calculateRecruitmentFees(salary,'15')!==null;
 const rateValid=calculateRecruitmentFees('0',comparison)!==null;
 const rateNumber=Number(comparison);
 const sliderValue=rateValid?rateNumber:20;
 const sliderMax=Math.max(35,Math.ceil(sliderValue/5)*5);
 const maxFee=estimate?Math.max(estimate.vorlen,estimate.other):0;
 const barWidth=(fee:number)=>maxFee?fee/maxFee*100:0;
 return <section className="fee-calculator" aria-labelledby="fee-title">
  <header className="fee-intro">
   <p className="fee-kicker">FREE EMPLOYER TOOL · PERMANENT RECRUITMENT</p>
   <h1 id="fee-title">Recruitment fee &amp; savings calculator</h1>
   <p>How much could you save on your next hire? Compare another agency's fee with Vorlen's standard 15% placement fee.</p>
  </header>
  <div className="fee-layout">
   <article className="fee-input-panel">
    <h2>Tell us about your hire</h2>
    <label htmlFor="fee-salary">Annual salary of your new employee</label>
    <div className="fee-input-wrap"><span aria-hidden="true">£</span><input id="fee-salary" type="number" inputMode="decimal" min="0" max={MAX_SALARY} step="0.01" value={salary} aria-invalid={!salaryValid} aria-describedby="fee-salary-help" onChange={e=>setSalary(e.target.value)}/></div>
    <p className="fee-help" id="fee-salary-help">{salaryValid?'Enter the agreed first-year salary for one permanent hire.':'Enter a salary from £0 to £10,000,000, with up to two decimal places.'}</p>
    <label htmlFor="fee-compare">Other agency's recruitment fee</label>
    <div className="fee-input-wrap fee-rate-wrap"><input id="fee-compare" type="number" inputMode="decimal" min="0" max={MAX_RATE} step="0.01" value={comparison} aria-invalid={!rateValid} aria-describedby="fee-rate-help" onChange={e=>setComparison(e.target.value)}/><span aria-hidden="true">%</span></div>
    <p className="fee-help" id="fee-rate-help">{rateValid?'Enter the rate you have been quoted, or adjust the example below.':'Enter a percentage from 0 to 100, with up to two decimal places.'}</p>
    <label className="fee-range-label" htmlFor="fee-range">Adjust comparison rate</label>
    <input className="fee-range" id="fee-range" type="range" min="0" max={sliderMax} step="0.5" value={sliderValue} onChange={e=>setComparison(e.target.value)} aria-valuetext={sliderValue+' percent'}/>
    <div className="fee-range-ends" aria-hidden="true"><span>0%</span><span>{sliderMax}%</span></div>
    <div className="fee-presets" aria-label="Example comparison rates">{[15,20,25,30].map(rate=><button type="button" key={rate} aria-pressed={rateValid&&rateNumber===rate} onClick={()=>setComparison(String(rate))}>{rate}%</button>)}</div>
    <div className="fee-standard"><strong>Vorlen's standard fee: {STANDARD_RATE}%</strong><p>One-off permanent placement fee, subject to written terms. Bespoke rates may differ.</p></div>
   </article>
   <article className="fee-results-panel">
    <h2>Your estimated recruitment fees</h2>
    <div aria-live="polite" aria-atomic="true">
     {estimate?<><div className="fee-comparison">
      <div className="fee-result"><span>Other agency · {estimate.rate}%</span><strong>{money(estimate.other)}</strong></div>
      <div className="fee-result fee-result-vorlen"><span>Vorlen · {STANDARD_RATE}%</span><strong>{money(estimate.vorlen)}</strong></div>
     </div>
     <div className="fee-bars" aria-hidden="true"><div><span>Other agency</span><div className="fee-bar-track"><div className="fee-bar-other" style={{width:barWidth(estimate.other)+'%'}}/></div></div><div><span>Vorlen</span><div className="fee-bar-track"><div className="fee-bar-vorlen" style={{width:barWidth(estimate.vorlen)+'%'}}/></div></div></div>
     <div className={'fee-difference '+(estimate.difference>0?'fee-saving':'fee-neutral')}>
      <span>{estimate.difference>0?'Your potential saving with Vorlen':estimate.difference<0?'Additional cost with Vorlen':'Difference in fees'}</span>
      <strong>{money(Math.abs(estimate.difference))}</strong>
      <p>{estimate.difference>0?'That is '+new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(estimate.percentageLower)+'% lower than the comparison fee you entered.':estimate.difference<0?'The comparison fee you entered is lower than Vorlen’s standard fee.':'Both estimated fees are the same.'}</p>
     </div></>:<p className="fee-invalid">Enter valid salary and comparison rate values to see your estimates.</p>}
    </div>
    <Link className="vorlen-button fee-cta" to="/contact?reason=employer">Discuss your hiring needs <ArrowRight size={18}/></Link>
    <p className="fee-disclaimer">Illustrative fees before any applicable VAT. The comparison rate is your own input, not a claim about another agency. No binding quote or guaranteed saving.</p>
   </article>
  </div>
 </section>
}
