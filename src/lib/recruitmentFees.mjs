export const STANDARD_RATE=15;
export const MAX_SALARY=10000000;
export const MAX_RATE=100;
// Use integer pennies and basis points, rounding each estimated fee to pennies.
export function calculateRecruitmentFees(salary,comparison){
 if(typeof salary!=='string'||typeof comparison!=='string'||!salary.trim()||!comparison.trim())return null;
 const amount=Number(salary),rate=Number(comparison);
 if(!Number.isFinite(amount)||!Number.isFinite(rate)||amount<0||amount>MAX_SALARY||rate<0||rate>MAX_RATE)return null;
 if(!/^\d+(?:\.\d{0,2})?$/.test(salary)||!/^\d+(?:\.\d{0,2})?$/.test(comparison))return null;
 const pennies=Math.round(amount*100),basisPoints=Math.round(rate*100);
 const vorlen=Math.round(pennies*1500/10000),other=Math.round(pennies*basisPoints/10000);
 const difference=other-vorlen;
 return {salary:amount,rate,vorlen:vorlen/100,other:other/100,difference:difference/100,percentageLower:difference>0&&other>0?difference/other*100:0};
}
