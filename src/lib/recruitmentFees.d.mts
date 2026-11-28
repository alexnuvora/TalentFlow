export const STANDARD_RATE:number, MAX_SALARY:number, MAX_RATE:number;
export type RecruitmentFeeEstimate={salary:number;rate:number;vorlen:number;other:number;difference:number;percentageLower:number};
export function calculateRecruitmentFees(salary:string,comparison:string):RecruitmentFeeEstimate|null;
