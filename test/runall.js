const {mockWb,run,load,template,readFixture}=require('./harness.js');const fs=require('fs');
const S=o=>JSON.stringify(o);
const tb=run('01_ReadTrialBalance',mockWb(load('tb.json'))),bs=run('02_ReadBSSS',mockWb(load('bsss.json')));
const F=f=>run('03_ReadYardiFinancial',mockWb(load(f)));const t12=F('t12.json'),bc=F('bc.json'),bal=F('bs.json');
const glr=run('05_ReadGeneralLedger',mockWb(load('gl.json')),'',25000,90);
const pmfee=run('07_ReadPMFee',mockWb(load('pmfee.json')));
const ameList=['ar','ap','gpr','sd','rr'].map(f=>run('06_ReadAMEReport',mockWb(load(f+'.json'))));
const sources=[["BSSS","07 2026 BS Support Schedule - 610 West.xlsm"],["TB","Trial_Balance_mn610wes_accrual.xlsx"],["GL","General_Ledger_mn610wes.xlsx"],["T12","12_Month_Statement_mn610wes_accrual.xlsx"],["BC","Budget_Comparison_mn610wes_accrual.xlsx"],["BANKREC","07 26 610 West Bank Reconciliation Package - COMBINED.pdf"],["MORTGAGE","610 West 08 26 Mortgage Statement.pdf"],["AME_AR","AgedReceivables.xlsx"],["AME_AP","PayablesAgingReport.xlsx"],["AME_GPR","GrossPotentialRent.xlsx"],["AME_SD","SecurityDepositActivity.xlsx"],["AME_RR","RentRollwithLeaseCharges.xlsx"],["PMFEE","07 2026 Yardi PM Fee - 610 West.xlsm"]].map(x=>({type:x[0],file:x[1],status:"Found"}));
const wb=template();
const res=run('04_RunInternalReview',wb,'mn610wes','07-2026','R1','Initial','mn610wes_07.2026_Internal_Review_R1.xlsx',S(sources),S(tb),S(bs),S(t12),S(bc),S(bal),S(glr),readFixture('pdf_bankrec.json'),readFixture('pdf_mortgage.json'),S(ameList),S(pmfee),'');
module.exports={res,wb,pmfee,tb,bs,t12,bc,bal,glr,ameList,sources,S};
if(require.main===module){require('fs').mkdirSync(require('path').join(__dirname,'..','build'),{recursive:true});require('fs').writeFileSync(require('path').join(__dirname,'..','build','filled.json'),JSON.stringify(wb._data));console.log({...res,findings:res.findings.length});
 for(const f of res.findings)console.log(f.status.padEnd(9),f.ruleId.padEnd(8),f.item.slice(0,48).padEnd(48),f.sourceValue.padStart(12),f.comparisonValue.padStart(12),f.difference.padStart(20));}
