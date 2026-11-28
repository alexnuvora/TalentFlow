import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateRecruitmentFees as calculate} from '../src/lib/recruitmentFees.mjs';
test('£70,000 at 25% comparison displays £7,000 saving and 40% lower fee',()=>{
 const result=calculate('70000','25');
 assert.deepEqual(result,{salary:70000,rate:25,vorlen:10500,other:17500,difference:7000,percentageLower:40});
});
test('default £40,000 comparison at 20%',()=>{assert.equal(calculate('40000','20').difference,2000);assert.equal(calculate('40000','20').percentageLower,25)});
test('lower and equal comparison rates are not shown as savings',()=>{assert.equal(calculate('40000','10').difference,-2000);assert.equal(calculate('40000','15').difference,0);assert.equal(calculate('40000','0').percentageLower,0)});
test('zero and precise currency amounts are supported',()=>{assert.equal(calculate('0','25').difference,0);assert.equal(calculate('100.03','20.25').vorlen,15);assert.equal(calculate('100.03','20.25').other,20.26)});
test('invalid and out of range input does not generate results',()=>{for(const [salary,rate] of [['','20'],['40000',''],['-1','20'],['10000001','20'],['100','101'],['100','-1'],['1e5','20'],['1.001','20'],['100','20.001'],['NaN','20']])assert.equal(calculate(salary,rate),null)});
