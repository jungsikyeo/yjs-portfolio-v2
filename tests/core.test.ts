import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePage,safeUrl,type Block} from '../lib/notion-parser';
import {createNotionClient,NotionError} from '../lib/notion-client';
import {synchronize,type Snapshot,type Store} from '../lib/sync';
import {demo,edges,narrativeSections} from '../lib/portfolio';
const block=(id:string,type:string,text:string,children?:Block[]):Block=>({id,type,[type]:{rich_text:[{plain_text:text}]},children});
test('nested content and explicit relations normalize without inventing achievements',()=>{const p=normalizePage('Resume',[block('a','paragraph','이름: 테스트'),block('b','heading_1','경력'),block('c','heading_2','회사 A'),block('d','paragraph','기간: 2020–2021'),block('e','heading_1','프로젝트'),block('f','heading_2','도구'),block('g','paragraph','회사: 회사 A',[block('h','paragraph','사용 기술: React, TypeScript')])]);assert.equal(p.name,'테스트');assert.equal(p.entries.find(e=>e.id==='f')?.parent,'c');assert.equal(edges(p.entries).length,4);assert.equal(p.demo,false);assert.equal(p.syncedAt,null);assert(!JSON.stringify(p).includes('%'));});
test('unsafe URLs are removed',()=>{assert.equal(safeUrl('javascript:alert(1)'),undefined);assert.equal(safeUrl('https://example.com'),'https://example.com/');});
test('pagination, nested blocks and excluding linked pages',async()=>{const paths:string[]=[];const fetcher=async(input:any)=>{const url=String(input);paths.push(url);if(url.includes('start_cursor'))return Response.json({results:[block('2','paragraph','second')],has_more:false});if(url.includes('/child/'))return Response.json({results:[block('nested','paragraph','nested')],has_more:false});return Response.json({results:[{...block('child','toggle','parent'),has_children:true},{id:'private',type:'child_page',has_children:true}],has_more:true,next_cursor:'cursor'})};const c=createNotionClient('test',fetcher as typeof fetch,async()=>{});const result=await c.blocks('root');assert.equal(result.length,2);assert.equal(result[0].children?.[0].id,'nested');assert(!paths.some(p=>p.includes('/private/')));assert.equal(paths.length,3)});
test('rate limit retry respects Retry-After and bounded retries',async()=>{let count=0;const waits:number[]=[];const c=createNotionClient('test',async()=>++count===1?new Response('',{status:429,headers:{'Retry-After':'2'}}):Response.json({ok:true}),async ms=>{waits.push(ms)});await c.request('pages/x');assert.equal(count,2);assert(waits.some(ms=>ms>=2000));});
function memory(data:Snapshot|null){let state=data;const store:Store={read:async()=>state,write:async v=>{state=v},lock:async()=>true};return store}
const real={...demo,demo:false,status:'ready' as const,syncedAt:'2026-01-01T00:00:00.000Z'};
test('cache hit avoids API, expiry updates and replaces deletions',async()=>{const store=memory({data:real,nextAttempt:300});let calls=0;assert.equal((await synchronize(store,async()=>{calls++;return real},200)).entries.length,10);assert.equal(calls,0);const updated=await synchronize(store,async()=>({...real,entries:[]}),400);assert.equal(updated.entries.length,0);assert.equal(updated.status,'ready');});
test('temporary failure preserves last successful data and timestamp',async()=>{const old=memory({data:real,nextAttempt:0});const stale=await synchronize(old,async()=>{throw new NotionError(503)},1000);assert.equal(stale.status,'stale');assert.equal(stale.syncedAt,real.syncedAt);assert.deepEqual(stale.entries,real.entries)});
test('first failure never inserts demo and revoked access clears cache',async()=>{const first=await synchronize(memory(null),async()=>{throw new Error('fail')},1000);assert.equal(first.demo,false);assert.equal(first.entries.length,0);assert.equal(first.syncedAt,null);const revoked=await synchronize(memory({data:real,nextAttempt:0}),async()=>{throw new NotionError(403)},1000);assert.equal(revoked.status,'error');assert.equal(revoked.entries.length,0)});

import {loadWorkspace} from '../lib/notion-workspace';
test('existing workspace mapping respects root, explicit relations and optional publication opt-out',async()=>{
 const prop=(s:string)=>({type:'rich_text',rich_text:[{plain_text:s}]});
 const rows:Record<string,any[]>={PROFILE:[{id:'me',properties:{name:prop('이름'),headline:prop('엔지니어'),summary:prop('소개')}}],EXPERIENCE:[{id:'job',properties:{company:prop('회사'),role:prop('개발'),stack:{multi_select:[{name:'TS'}]}}}],PROJECT:[{id:'p',properties:{title:prop('프로젝트'),experience:{relation:[{id:'job'}]},stack:{multi_select:[{name:'TS'}]},featured:{checkbox:true}}},{id:'hidden',properties:{Published:{checkbox:false}}}],SKILL:[{id:'ts',properties:{name:prop('TS'),category:{select:{name:'언어'}}}}]};
 const client={request:async(path:string)=>{if(path==='pages/root')return {};if(path.startsWith('databases/'))return {parent:{type:'page_id',page_id:'root'},data_sources:[{id:path.split('/')[1]}]};return {results:rows[path.split('/')[1]],has_more:false}},blocks:async()=>[]};
 const result=await loadWorkspace(client as any,'root',{PROFILE:'PROFILE',EXPERIENCE:'EXPERIENCE',PROJECT:'PROJECT',SKILL:'SKILL'});assert.equal(result.demo,false);assert.equal(result.entries.length,4);assert.equal(result.entries.find(e=>e.id==='p')?.parent,'job');assert.deepEqual(result.entries.find(e=>e.id==='p')?.tags,['ts']);assert.equal(result.entries.find(e=>e.id==='ts')?.subtitle,'언어');
 await assert.rejects(()=>loadWorkspace({...client,request:async(path:string)=>path.startsWith('databases/')?{parent:{type:'page_id',page_id:'other'}}:{}} as any,'root',{PROFILE:'PROFILE',EXPERIENCE:'EXPERIENCE',PROJECT:'PROJECT',SKILL:'SKILL'}));
});

test('unchanged pages reuse cached bodies instead of calling the blocks API',async()=>{
 const prop=(s:string)=>({type:'rich_text',rich_text:[{plain_text:s}]});
 const rows:Record<string,any[]>={PROFILE:[{id:'me',last_edited_time:'t1',properties:{name:prop('이름'),headline:prop('엔지니어'),summary:prop('소개')}}],EXPERIENCE:[{id:'job',last_edited_time:'t1',properties:{company:prop('회사')}}],PROJECT:[],SKILL:[]};
 let calls=0;
 const client={request:async(path:string)=>{if(path==='pages/root')return {};if(path.startsWith('databases/'))return {parent:{type:'page_id',page_id:'root'},data_sources:[{id:path.split('/')[1]}]};return {results:rows[path.split('/')[1]],has_more:false}},blocks:async()=>{calls++;return [{type:'paragraph',paragraph:{rich_text:[{plain_text:'본문'}]}}]}};
 const store=new Map<string,{edited:string;body:string[]}>();const cache={get:(id:string)=>store.get(id),set:(id:string,edited:string,body:string[])=>store.set(id,{edited,body})};
 const config={PROFILE:'PROFILE',EXPERIENCE:'EXPERIENCE',PROJECT:'PROJECT',SKILL:'SKILL'};
 await loadWorkspace(client as any,'root',config,cache);assert.equal(calls,2);
 const again=await loadWorkspace(client as any,'root',config,cache);assert.equal(calls,2);assert.deepEqual(again.entries.find(e=>e.id==='job')?.body,['본문']);
 rows.EXPERIENCE[0].last_edited_time='t2';await loadWorkspace(client as any,'root',config,cache);assert.equal(calls,3);
});

test('규모 and the labeled 성과 line become their own overview sections instead of being swallowed by 판단',()=>{const body=['역할 · 단독 개발','기간 · 2026.06 — 현재','배경','만든 이유','한 일','한 것 1','한 것 2','판단','고른 이유','규모','1,256커밋 중 1,228커밋','성과 · 4종 배포'];const s=narrativeSections({body,role:'단독 개발',period:'2026.06 — 현재'});assert.deepEqual(s.process,[{title:'한 일',lines:['한 것 1','한 것 2']}]);assert.deepEqual(s.overview,[{title:'배경',lines:['만든 이유']},{title:'판단',lines:['고른 이유']},{title:'규모',lines:['1,256커밋 중 1,228커밋']},{title:'성과',lines:['4종 배포']}]);});

import {buildResume,wrapText,yearsOfExperience,FEATURED_BULLETS,STACK_LIMIT} from '../lib/resume';
import {validateContact,contactEmail} from '../lib/contact';
test('résumé projection: years, five-layer experiences with project stacks, featured projects with company and stack, tables',()=>{
 const data:typeof real={...real,email:'me@example.com',links:[{label:'GitHub',url:'https://github.com/x'}],credentials:[{title:'학사',issuer:'대학',date:'2010-02-01'},{title:'기사',issuer:'공단',date:'2013-05-01'}],entries:[
  {id:'me',kind:'person',title:'이름',subtitle:'',body:['소개'],tags:[]},
  {id:'job',kind:'experience',title:'회사',subtitle:'',period:'2025.01 — 현재',role:'PM · DEV',body:['요약','한 것 1','한 것 2','한 것 3','한 것 4'],tags:['Java']},
  {id:'old',kind:'experience',title:'옛회사',subtitle:'',period:'2009.09 — 2011.10',role:'DEV',body:['옛 요약'],tags:[]},
  {id:'p1',kind:'project',title:'대표',subtitle:'한 줄',featured:true,period:'2026.01 — 2026.02',role:'단독',parent:'job',url:'https://example.com/p1',body:['역할 · 단독','기간 · 2026.01','배경','왜','한 일','a','b','c','d','판단','그래서'],tags:['TS','skill:Nuxt 3']},
  {id:'p2',kind:'project',title:'기타',subtitle:'요약',parent:'job',body:['배경','왜'],tags:['TS']},
  {id:'TS',kind:'skill',title:'TS',subtitle:'Frontend',body:[],tags:[]},{id:'Java',kind:'skill',title:'Java',subtitle:'Backend',body:[],tags:[]}]};
 const now=new Date('2026-09-13T00:00:00Z');
 assert.equal(yearsOfExperience(data.entries,now),17);
 const doc=buildResume(data,now);
 assert.equal(doc.years,17);assert.deepEqual(doc.contacts,[{label:'me@example.com',url:'mailto:me@example.com'},{label:'https://github.com/x',url:'https://github.com/x'}]);
 assert.deepEqual(doc.sections.map(s=>[s.title,s.layout]),[['경력','block'],['주요 프로젝트','block'],['기타 프로젝트','compact'],['기술','table'],['학력 · 자격','table']]);
 const job=doc.sections[0].items[0];assert.equal(job.meta,'2025.01 ~ 현재');assert.equal(job.role,'PM · DEV');assert.equal(job.summary,'요약');assert.equal(job.bullets.length,FEATURED_BULLETS);
 assert.deepEqual(job.stack,['Java','TS','Nuxt 3']);assert.ok(STACK_LIMIT>=8);
 const p1=doc.sections[1].items[0];assert.deepEqual(p1.bullets,['a','b','c']);assert.equal(p1.company,'회사');assert.deepEqual(p1.stack,['TS','Nuxt 3']);assert.equal(p1.url,'https://example.com/p1');assert.equal(p1.role,'단독');
 assert.equal(doc.sections[2].items[0].summary,'요약');
 assert.deepEqual(doc.sections[3].items.map(i=>[i.label,i.title]),[['Frontend','TS'],['Backend','Java']]);
 assert.deepEqual(doc.sections[4].items.map(i=>[i.label,i.meta]),[['학력','2010.02'],['자격','2013.05']]);
});
test('wrapText breaks on spaces first and inside over-long tokens as a last resort',()=>{
 const measure=(s:string)=>s.length;
 assert.deepEqual(wrapText('aaa bbb ccc',7,measure),['aaa bbb','ccc']);
 assert.deepEqual(wrapText('abcdefghij kl',4,measure),['abcd','efgh','ij','kl']);
 assert.deepEqual(wrapText('   ',10,measure),[]);
});
test('contact validation trims, bounds, rejects bad email and short text, and flags the honeypot',()=>{
 assert.deepEqual(validateContact({name:' 홍길동 ',email:'a@b.co',message:'열 글자는 넘는 문의 내용입니다'}),{ok:true,value:{name:'홍길동',email:'a@b.co',company:undefined,message:'열 글자는 넘는 문의 내용입니다'}});
 assert.equal(validateContact({name:'x',email:'nope',message:'열 글자는 넘는 문의 내용입니다'}).ok,false);
 assert.equal(validateContact({name:'x',email:'a@b.co',message:'짧음'}).ok,false);
 assert.deepEqual(validateContact({name:'x',email:'a@b.co',message:'열 글자는 넘는 문의 내용입니다',website:'http://spam'}),{ok:false,error:'honeypot'});
 assert.equal(validateContact({name:'x'.repeat(100),email:'a@b.co',message:'열 글자는 넘는 문의 내용입니다'}).ok&&(validateContact({name:'x'.repeat(100),email:'a@b.co',message:'열 글자는 넘는 문의 내용입니다'}) as any).value.name.length,60);
 const mail=contactEmail({name:'홍길동',email:'a@b.co',company:'회사',message:'안녕하세요'},'portfolio.yeojs.dev');
 assert.equal(mail.subject,'[portfolio.yeojs.dev] 홍길동 (회사) 님의 연락');assert.match(mail.text,/이메일: a@b.co/);
});
