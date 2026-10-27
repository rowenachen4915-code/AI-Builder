const {mockWb,run,load,template,readFixture}=require('./harness.js');const fs=require('fs');const S=o=>JSON.stringify(o),C=o=>JSON.parse(JSON.stringify(o));
const TB0=run('01_ReadTrialBalance',mockWb(load('tb.json'))),BS0=run('02_ReadBSSS',mockWb(load('bsss.json')));
const F=f=>run('03_ReadYardiFinancial',mockWb(load(f)));const T0=F('t12.json'),BC0=F('bc.json'),BAL0=F('bs.json');
const GL0=run('05_ReadGeneralLedger',mockWb(load('gl.json')),'',25000,90);
const PMF0=run('07_ReadPMFee',mockWb(load('pmfee.json')));
const AME0=['ar','ap','gpr','sd','rr'].map(f=>run('06_ReadAMEReport',mockWb(load(f+'.json'))));
const REC0=JSON.parse(readFixture('pdf_bankrec.json')),MTG0=JSON.parse(readFixture('pdf_mortgage.json'));
function review(o={}){const x={code:'mn610wes',per:'07-2026',tb:C(TB0),bs:C(BS0),t12:C(T0),bc:C(BC0),bal:null,gl:C(GL0),rec:C(REC0),mtg:C(MTG0),ame:C(AME0),fee:C(PMF0),src:'',...o};const wb=template();
  const j=v=>v===null?'':(typeof v==='string'?v:S(v));
  const r=run('04_RunInternalReview',wb,x.code,x.per,'R1','Initial','f.xlsx',x.src,j(x.tb),j(x.bs),j(x.t12),j(x.bc),j(x.bal),j(x.gl),j(x.rec),j(x.mtg),j(x.ame),j(x.fee),'');r.wb=wb;return r}
let pass=0,fail=0;const t=(n,c)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n)};const has=(r,rule,re)=>r.findings.some(f=>f.ruleId===rule&&(!re||re.test(f.item+' '+f.finding)));
let r,o;
r=review();t('real packet without the stale Balance Sheet: the only exception is the 91-day reconciling item',r.exceptions===1&&r.findings.some(f=>f.ruleId==='CASH-03'&&f.status==='Exception'&&/American Bankers/.test(f.item)));t('91-day reconciling item is an Exception (over 90 days)',r.findings.some(f=>f.ruleId==='CASH-03'&&f.status==='Exception'&&/American Bankers/.test(f.item)&&f.difference==='91 days'));t('no check is over 60 days, so none is a Warning or Exception',!has(r,'CASH-02'));
r=review({bal:C(BAL0)});t('stale Balance Sheet caught (22010 + current year earnings)',has(r,'BS-01',/22010/)&&has(r,'BS-02')&&r.exceptions===3);
o=C(TB0);o.rows.find(x=>x.account==='22005-000').ending=-22786.58;o.sumEnding=-0.01;r=review({tb:o});t('one cent BSSS difference = exception',r.findings.some(f=>f.ruleId==='BSSS-01'&&f.difference==='0.01'));t('review kept going after exception',r.passed>30);
o=C(BS0);o.rows.find(x=>x.account==='33000-000').balance=-10629039;r=review({bs:o});t('reversed sign called out',has(r,'BSSS-01',/sign is reversed/));
o=C(BS0);o.rows=o.rows.filter(x=>x.account!=='22080-000');r=review({bs:o});t('accrual with no schedule = exception',has(r,'BSSS-02',/22080/));
o=C(BS0);o.rows.push(C(o.rows[0]));r=review({bs:o});t('duplicate support flagged',has(r,'BSSS-03'));
o=C(BS0);o.items.push({account:'12075-000',date:'2026-05-15',description:'Insurance claim receivable',amount:500,sourceCell:'G27'});r=review({bs:o});t('AR Other item 77 days old = exception',has(r,'AR-01',/77 days/));
r=review({per:'06-2026'});t('wrong period: sources rejected, no tie-outs run',has(r,'SRC-02')&&!r.findings.some(f=>/^(BSSS|CASH|DEBT)/.test(f.ruleId)));
r=review({code:'tx123abc'});t('wrong property rejected',has(r,'SRC-02'));
r=review({t12:null});t('missing T12 = SRC-01 exception, rest still runs',has(r,'SRC-01',/T12/)&&r.passed>30);
r=review({rec:null});t('cash on TB but no bank rec = exception',has(r,'SRC-01',/Bank Rec/));
r=review({mtg:null});t('debt on TB but no mortgage statement = exception',has(r,'SRC-01',/Mortgage/));
r=review({rec:'this is not json'});t('unreadable PDF output handled, no crash',has(r,'SRC-01',/Bank Rec/));
o=C(REC0);o.bankRecs[0].outstandingChecks[3].amount=2951.00;r=review({rec:o});t('misread check amount named to its section',has(r,'CASH-00',/Outstanding checks/)&&r.findings.filter(f=>f.ruleId==='CASH-00')[0].status==='Warning');
o=C(REC0);o.bankRecs[0].outstandingDeposits.splice(2,1);r=review({rec:o});t('missed deposit line named, tie-out still passes',has(r,'CASH-00',/Outstanding deposits/)&&r.findings.every(f=>f.ruleId!=='CASH-01'));
o=C(REC0);o.bankRecs[0].reconciledBankBalance=284000;r=review({rec:o});t('subtotals that do not foot = exception',r.findings.some(f=>f.ruleId==='CASH-00'&&f.status==='Exception'));
o=C(REC0);o.bankRecs[0].outstandingChecks[0].date='2026-05-20';r=review({rec:o});t('check 72 days old = warning',has(r,'CASH-02',/72 days/));
o=C(REC0);o.bankRecs[0].glBalance=284000;o.bankRecs[0].glAccount='11020-000';r=review({rec:o});t('bank rec GL balance off = exception',has(r,'CASH-01'));
o=C(REC0);o.bankRecs.pop();r=review({rec:o});t('cash account without a rec = exception',has(r,'CASH-04',/11040/));
o=C(MTG0);o.mortgages[0].principalBalance=77800000;r=review({mtg:o});t('principal off = exception',has(r,'DEBT-01'));
o=C(MTG0);o.mortgages[0].taxEscrowBalance=700000;r=review({mtg:o});t('escrow off = warning',has(r,'DEBT-02',/Tax/));
o=C(MTG0);o.mortgages[0].paymentDueDate='2026-07-01';r=review({mtg:o});t('wrong month statement = warning',has(r,'DEBT-04'));
o=C(BC0);const pa=o.columns.indexOf('PTD Actual');o.rows.filter(x=>x.section==='Insurance'&&x.kind==='detail').forEach(x=>x.values[pa]=0);r=review({bc:o,tb:C(TB0)});t('insurance not recorded = MAJOR-01 exception',has(r,'MAJOR-01',/Insurance/));
o=C(T0);o.rows.find(x=>x.account==='59110-000').values[11]=0;r=review({t12:o});t('utility with history and $0 current = UTIL-02 exception',has(r,'UTIL-02',/59110/));
r=review({tb:null,bs:null,t12:null,bc:null,gl:null,rec:null,mtg:null});t('nothing provided: 5 missing-source exceptions, no crash',r.findings.filter(f=>f.ruleId==='SRC-01').length===5);
o=C(BS0);for(let i=0;i<120;i++)o.rows.push({account:(12100+i)+'-000',name:'x',balance:1,sourceTab:'CY',sourceCell:'G1'});r=review({bs:o});t('more than 100 BSSS findings: table resized, all written',r.wb._tables.tblBSSS.resized&&r.wb._data['BSSS'].vals.length>=123);
r=review({src:S([{type:'BC',file:'a.xlsx, b.xlsx',status:'Multiple Versions'}])});t('multiple versions reported from the flow',has(r,'SRC-01',/More than one/));
r=review({rec:S({responsev2:{predictionOutput:{text:S(REC0),finishReason:'stop'}}}),mtg:S({body:{structuredOutput:MTG0}})});t('PDF results found inside the raw prompt response (same result as the plain JSON)',r.exceptions===1&&r.findings.some(f=>f.ruleId==='CASH-03'&&/American Bankers/.test(f.item)));
r=review();t('GL ties to TB, no GL exceptions',!r.findings.some(f=>/^GL-0[13]/.test(f.ruleId)));
o=C(GL0);o.accounts.find(x=>x.account==='22010-000').ending=-85000;r=review({gl:o});t('stale GL caught by GL-01',has(r,'GL-01',/22010/));
o=C(GL0);o.accruals.find(x=>x.account==='22010-000').clearedToZero=false;o.accruals.find(x=>x.account==='22010-000').firstNewBeforeClear='2026-07-15 new accrual';r=review({gl:o});t('accrual not cleared = ACCR-01 exception',has(r,'ACCR-01',/22010/));
o=C(GL0);o.wrongPostPeriod=3;r=review({gl:o});t('entries posted to another period = exception',has(r,'GL-03'));
r=review({gl:null});t('missing GL = SRC-01 exception, rest still runs',has(r,'SRC-01',/General Ledger/)&&r.passed>30);
r=review();t('AME: AR, prepaid, AP, SD, market rent all tie',!r.findings.some(f=>/^AME-0[123]/.test(f.ruleId)));
o=C(AME0);o.find(x=>x.reportType==='AR').values.find(v=>v.key==='arTotal').amount=132015.96;r=review({ame:o});t('AR one dollar off = exception',has(r,'AME-01',/Accounts receivable/));
o=C(AME0);o.find(x=>x.reportType==='AP').values.find(v=>v.key==='apTotal').amount=70000;r=review({ame:o});t('AP aging off = exception',has(r,'AME-01',/Accounts payable/));
o=C(AME0);o.find(x=>x.reportType==='SD').values.find(v=>v.key==='sdDelinquent').amount=0;r=review({ame:o});t('SD tie fails without the delinquent reconciling item',has(r,'AME-02'));
o=C(AME0);o.find(x=>x.reportType==='RR').values.find(v=>v.key==='rrMarketRent').amount=1057096;r=review({ame:o});t('rent roll vs GPR market rent mismatch caught',has(r,'AME-03'));
o=C(AME0);o.find(x=>x.reportType==='GPR').values.find(v=>v.key==='gprMarketRent').amount=1057096;r=review({ame:o});t('GPR revenue-unit total used by mistake is caught by the rent roll cross-check',has(r,'AME-03')&&r.monitor>0);
o=C(AME0);o.find(x=>x.reportType==='AR').propertyCode='tx123abc';r=review({ame:o});t('AME report for the wrong property = exception',has(r,'AME-00',/different property/));
r=review({ame:[]});t('no AME files: review still runs, no AME findings',r.passed>30&&!r.findings.some(f=>/^AME/.test(f.ruleId)));
let tb2=C(TB0);tb2.rows.find(x=>x.account==='11040-000').ending=300000;r=review({tb:tb2});t('security deposit cash short of liability = exception',has(r,'SD-01',/short/));
tb2=C(TB0);tb2.rows.find(x=>x.account==='23040-000').ending=-500;r=review({tb:tb2});t('balance stranded in clearing = exception',has(r,'CLR-01'));
tb2=C(TB0);tb2.rows.find(x=>x.account==='21010-000').ending=5000;r=review({tb:tb2});t('AP in debit = abnormal balance exception',has(r,'BAL-01',/21010/));
r=review();t('PM fee: base, recalculation, GL tie and adjustment trace all pass',!r.findings.some(f=>/^PMF/.test(f.ruleId)));
o=C(PMF0);o.baseLines[1].hardcoded=true;r=review({fee:o});t('typed-over base line = exception',has(r,'PMF-02'));
o=C(PMF0);o.feeRate=0.03;r=review({fee:o});t('wrong rate used = recalculation exception',has(r,'PMF-03'));
o=C(PMF0);o.feeDue=25000;r=review({fee:o});t('fee not equal to base x rate = exception',has(r,'PMF-03'));
o=C(PMF0);o.adjustments.find(a=>a.amount===2523.78).amount=5000;r=review({fee:o});t('adjustment with no matching JE in the GL = exception',has(r,'PMF-05',/No journal entry/));
o=C(PMF0);o.adjustments.find(a=>a.amount===2523.78).glAccount='';r=review({fee:o});t('adjustment with no GL code = monitor',r.monitor>0&&!has(r,'PMF-05'));
o=C(PMF0);r=review({fee:o,gl:null});t('adjustment cannot be traced without the GL = monitor, not a false pass',r.monitor>0);
o=C(PMF0);o.trailing.find(m=>m.month==='07-2026').base=1400000;r=review({fee:o});t('revenue spike in the fee base = exception',has(r,'PMF-07',/jumped/));
o=C(PMF0);o.trailing.find(m=>m.month==='07-2026').base=700000;r=review({fee:o});t('fee base falling is not flagged as a spike',!has(r,'PMF-07'));
o=C(PMF0);o.minimumFee=30000;o.feeDue=30000;r=review({fee:o});t('minimum fee applied correctly still passes',!has(r,'PMF-03'));
o=C(PMF0);o.propertyCode='tx123abc';r=review({fee:o});t('PM fee workbook for the wrong property = exception, no fee tests run',has(r,'PMF-00')&&!r.findings.some(f=>/^PMF-0[1-8]/.test(f.ruleId)));
let tbz=C(TB0);tbz.rows.find(x=>x.account==='61030-000').debit=20000;r=review({tb:tbz});t('fee expensed differs from fee calculated = exception',has(r,'PMF-04'));
r=review({fee:null});t('no PM fee workbook: review still runs',r.passed>30&&!r.findings.some(f=>/^PMF/.test(f.ruleId)));

// ---- A bad input to Run Review is a finding, never a crash (flprereg 08-2026 R2 died on "Cannot read properties of undefined (reading 'forEach')")
for (const bad of ['[]','{}','"x"','not json']) { let ok=true,res; try{res=review({fee:bad})}catch(e){ok=false}
  t(`PM Fee input ${bad}: review completes and says the input was not a reader result`,ok&&res.findings.some(f=>f.ruleId==='SRC-03'&&/PM Fee/.test(f.item))&&!res.findings.some(f=>/^PMF/.test(f.ruleId))); }
{ let ok=true,res; try{res=review({tb:'[]',gl:'{}',ame:'{}',src:'{}'})}catch(e){ok=false}
  t('TB [] / GL {} / AME {} / sources {}: review completes, TB and GL flagged as unusable',ok&&has(res,'SRC-03',/Trial Balance/)&&has(res,'SRC-03',/General Ledger/)); }
{ const plain=review(),wrapped=review({fee:S({result:PMF0}),tb:S({body:{result:TB0}})});
  t('reader result wrapped in the flow step output ({result: ...}) gives the same review as the plain result',wrapped.exceptions===plain.exceptions&&wrapped.warnings===plain.warnings&&wrapped.monitor===plain.monitor&&wrapped.passed===plain.passed); }

// ---- One bank rec PDF per account (flprereg: separate OP and SD PDFs). The flow passes a list of prompt responses.
{ const op=C(REC0),sd=C(REC0);op.bankRecs=[REC0.bankRecs[0]];sd.bankRecs=[REC0.bankRecs[1]];
  const r1=review(),r2=review({rec:S([{responsev2:{predictionOutput:{text:S(op),finishReason:'stop'}}},{body:{structuredOutput:sd}}])});
  t('two PDFs, one rec each: same review as the combined package',r2.exceptions===r1.exceptions&&r2.warnings===r1.warnings&&r2.monitor===r1.monitor&&r2.passed===r1.passed&&!has(r2,'CASH-04')&&!has(r2,'CASH-06'));
  const r3=review({rec:S([op,op,sd])});
  t('the same rec provided twice = CASH-06 exception naming the account',r3.findings.some(f=>f.ruleId==='CASH-06'&&f.status==='Exception'));
  t('only one of two recs provided: the other cash account is CASH-04',has(review({rec:S([op])}),'CASH-04'));
  const multi=S([{type:'BANKREC',file:'2 bank rec PDFs',status:'Multiple Versions'}]);
  t('several bank rec PDFs that were all read are not a Multiple Versions exception',!has(review({src:multi,rec:S([op,sd])}),'SRC-01'));
  t('several bank rec PDFs that were not read are still a Multiple Versions exception',has(review({src:multi,rec:null}),'SRC-01',/More than one/)); }

// ---- Client-owned Yardi: reports carry the client's code (rpresshi's files say c6us0871). Flow passes "ourcode,clientcode".
{ const alias=o=>{o=C(o);o.propertyCode='c6us0871';return o};
  const x={tb:alias(TB0),bs:alias(BS0),t12:alias(T0),bc:alias(BC0),gl:alias(GL0),fee:alias(PMF0)};
  const run2=(pc)=>{const wb=template();const j=v=>typeof v==='string'?v:S(v);
    return run('04_RunInternalReview',wb,pc,'07-2026','R1','Initial','f.xlsx','',j(x.tb),j(x.bs),j(x.t12),j(x.bc),'',j(x.gl),S(REC0),S(MTG0),S(AME0.map(a=>{a=C(a);a.propertyCode='c6us0871';return a})),j(x.fee),'')};
  const plain=review({bal:null}), mapped=run2('mn610wes,c6us0871'), unmapped=run2('mn610wes');
  t('client Yardi code mapped: files under c6us0871 pass as mn610wes, same review as the plain packet',!has(mapped,'SRC-02')&&!has(mapped,'AME-00')&&!has(mapped,'PMF-00')&&mapped.exceptions===plain.exceptions&&mapped.passed===plain.passed);
  t('client Yardi code mapped: findings and keys stay under our code',mapped.findings.every(f=>f.propertyCode==='mn610wes'&&f.findingKey.startsWith('mn610wes|')));
  t('client Yardi code not mapped: every file is the wrong property',has(unmapped,'SRC-02',/different property/)&&has(unmapped,'PMF-00')); }

// ---- Manager-confirmed identity: the agent asked, the manager said yes, the flow re-ran with the accepted code/period.
{ const conf=S([{type:'CONFIRMATION',file:'code -, period 07-2026 accepted by rowena.chen@greystar.com on 2026-10-27',status:'Accepted'}]);
  const runP=(per,src)=>{const wb=template();const j=v=>v===null?'':(typeof v==='string'?v:S(v));
    const r=run('04_RunInternalReview',wb,'mn610wes',per,'R1','Initial','f.xlsx',src||'',j(TB0),j(BS0),j(T0),j(BC0),'',j(GL0),S(REC0),S(MTG0),S(AME0),S(PMF0),'');r.wb=wb;return r};
  const plain=review({bal:null}), acc=runP('08-2026,07-2026',conf), rej=runP('08-2026');
  t('accepted period: files for 07-2026 pass as the 08-2026 review, no wrong-period exceptions',!has(acc,'SRC-02',/different/)&&!has(acc,'AME-00')&&!has(acc,'PMF-00')&&acc.exceptions===plain.exceptions);
  t('accepted period: report and keys keep the requested period, accounting runs on the files\' period (91-day item still 91 days)',acc.findings.every(f=>f.reviewPeriod==='08-2026')&&acc.wb._data['Executive Summary'].vals[4][1]==='08-2026'&&acc.findings.some(f=>f.ruleId==='CASH-03'&&f.difference==='91 days'));
  const inWb=(r,rule,re)=>r.wb._data['All Results'].vals.slice(3).some(x=>x[14]===rule&&x[2]==='Reviewed / Monitor'&&re.test(String(x[4])));   // Monitor findings are in the report, not in the returned list
  t('accepted period: SRC-04 Monitor finding records who accepted it and when',inWb(acc,'SRC-04',/rowena.chen@greystar.com on 2026-10-27/)&&acc.monitor===plain.monitor+1);
  { const o=C(TB0);o.propertyCode='c6us0871';const wb=template();const r=run('04_RunInternalReview',wb,'mn610wes,c6us0871','07-2026','R1','Initial','f.xlsx','',S(o),S(BS0),'','','','','','','[]','','');r.wb=wb;
    t('accepted code without confirmation details still gets an SRC-04 finding',inWb(r,'SRC-04',/not supplied/)); }
  t('period not accepted: files for 07-2026 under an 08-2026 request are wrong-period exceptions, no SRC-04',has(rej,'SRC-02',/different/)&&!has(rej,'SRC-04')); }

// ---- Report template v2.0: layout, routing, Executive Summary sections
{ const g=require('./runall.js'); const d=g.wb._data;
  const hdr=d['BSSS'].vals[2]; t('v2 layout: Status, Account / Item, Finding, Required Action are the first four columns',hdr[0]==='Status'&&hdr[1]==='Account / Item'&&hdr[2]==='Finding'&&hdr[3]==='Required Action');
  const bs=d['BSSS'].vals.slice(3).filter(r=>r[0]!==''); t('v2 BSSS tab: every BSSS finding is on it and the 22 schedules show as Pass',bs.filter(r=>r[12]==='BSSS-01'&&r[0]==='Pass').length===22);
  const all=d['All Results'].vals.slice(3).filter(r=>r[0]!==''); const onTabs=['Source Validation','BSSS','Bank Rec','T12','Budget Comparison','General Ledger','PM Fee','Other Controls'].reduce((n,tab)=>n+d[tab].vals.slice(tab==='Source Validation'?13:3).filter(r=>r[0]!==''&&/^(Exception|Warning|Reviewed \/ Monitor|Pass)$/.test(r[0])).length,0);
  t('v2 routing: every finding appears on exactly one area tab (area tabs total = All Results)',onTabs===all.length&&all.length===g.res.exceptions+g.res.warnings+g.res.monitor+g.res.passed);
  const br=d['Bank Rec'].vals.slice(3).filter(r=>r[0]!==''); t('v2 sorting: Bank Rec tab lists the Exception first',br[0][0]==='Exception'&&/American Bankers/.test(br[0][1]));
  const es=d['Executive Summary'].vals; t('v2 exec: operating rec is Exception, oldest 91 days, 9 items over 30',es[43][1]==='Exception'&&es[43][6]===91&&es[43][7]===9);
  t('v2 exec: security deposit rec is Clean',es[44][1]==='Clean'&&es[44][7]===0);
  t('v2 exec: BSSS attention list says everything ties',/All BSSS schedules tie/.test(es[29][0]));
  t('manager decision: Executive Summary D8 is blank for the manager, with no readiness formula',es[7][3]===''&&!/READY/i.test(String(es[7][3])));
  t('manager decision: Review History records the run with the decision column left blank',d['Review History'].vals[3][0]==='R1'&&d['Review History'].vals[3][3]==='');
  t('manager decision: the Teams summary gives counts but no readiness verdict',!/READY/i.test(g.res.summary)&&/Awaiting manager decision/.test(g.res.summary)&&g.res.overallStatus==='REVIEW COMPLETE');
  t('v2 exec: period written as text 07-2026 and report file name filled',es[4][1]==='07-2026'&&/_R1\.xlsx$/.test(es[5][5]));
}
{ let o=C(BS0);o.rows.find(x=>x.account==='22005-000').balance=-22000;const r=review({bs:o});const es=r.wb._data['Executive Summary'].vals;
  t('v2 exec: a BSSS difference is listed under Accounts Needing Attention as Does Not Tie',es[29][0].startsWith('22005-000')&&es[29][1]==='Does Not Tie'&&es[29][4]===786.57); }
{ let o=C(BS0);o.rows=o.rows.filter(x=>x.account!=='22080-000');const r=review({bs:o});const es=r.wb._data['Executive Summary'].vals;
  t('v2 exec: an account with no schedule is listed as Missing Information',es.slice(29,39).some(x=>String(x[0]).startsWith('22080-000')&&x[1]==='Missing Information')); }
{ let o=C(REC0);o.bankRecs[0].reconcilingItems=[o.bankRecs[0].reconcilingItems[4]];o.bankRecs[0].outstandingDeposits=o.bankRecs[0].outstandingDeposits.slice(5);o.bankRecs[0].outstandingChecks=o.bankRecs[0].outstandingChecks.slice(3);
  const r=review({rec:o});const es=r.wb._data['Executive Summary'].vals;
  t('v2 bank rec: nothing over 30 days = Clean',es[43][1]==='Clean'&&es[43][7]===0); }
{ let o=C(REC0);o.bankRecs[1].otherItems[0].date='2026-06-15';const r=review({rec:o});const es=r.wb._data['Executive Summary'].vals;
  t('v2 bank rec: oldest item 46 days = Monitor, and it is not a Warning',es[44][1]==='Monitor'&&!r.findings.some(f=>/Security Deposit/.test(f.item)&&f.ruleId==='CASH-03')); }
{ let o=C(REC0);o.bankRecs[1].otherItems[0].date='2026-05-20';const r=review({rec:o});const es=r.wb._data['Executive Summary'].vals;
  t('v2 bank rec: oldest item 72 days = Warning',es[44][1]==='Warning'); }
{ let o=C(REC0);o.bankRecs[1].glBalance=350000;const r=review({rec:o});const es=r.wb._data['Executive Summary'].vals;
  t('v2 bank rec: a rec that does not tie is an Exception even with nothing old',es[44][1]==='Exception'); }
{ let o=C(REC0);o.bankRecs.pop();const r=review({rec:o});const es=r.wb._data['Executive Summary'].vals;
  t('v2 bank rec: a cash account with no rec appears as an Exception row',es.slice(43,51).some(x=>x[2]==='11040-000'&&x[1]==='Exception')); }

// Golden calibration result: the whole 610 West 07-2026 packet. A change that moves these counts must be explained.
{ const g=require('./runall.js').res; t('GOLDEN: 610 West 07-2026 = 3 exceptions, 44 warnings, 58 monitor, 85 passed',g.exceptions===3&&g.warnings===44&&g.monitor===58&&g.passed===85); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
