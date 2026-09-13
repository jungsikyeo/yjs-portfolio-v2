import {type Portfolio,type Entry,narrativeSections} from './portfolio';
// The résumé is a projection of the same Notion data the site renders: profile with years of
// experience, every experience as a five-layer block (company · period / role / summary / bullets /
// stack), featured projects with their first work-log lines, the rest of the projects as one-liners,
// skills and credentials as label/value tables. Layout-agnostic so it can be unit-tested; the PDF
// generator only turns this model into pages.
export type ResumeItem={title:string;meta?:string;role?:string;company?:string;summary?:string;bullets:string[];stack?:string[];url?:string;label?:string};
export type ResumeSection={title:string;items:ResumeItem[];layout:'block'|'compact'|'table'};
export type ResumeDoc={name:string;role:string;years?:number;intro:string;contacts:{label:string;url?:string}[];sections:ResumeSection[];generatedAt:string};
export const FEATURED_BULLETS=3;
// An experience's stack line stays one or two lines; the projects underneath carry the full lists.
export const STACK_LIMIT=12;
const cleanRole=(role?:string)=>role?.replace(/\s*[·]\s*/g,' · ').trim();
// Notion periods use an em dash; the printed résumé uses a tilde, which Korean résumés conventionally do.
const periodOf=(period?:string)=>period?.replace(/\s*[—–]\s*/g,' ~ ');
// Periods arrive as "2024.09 — 2026.02" or "2025.01 — 현재"; the first YYYY.MM is the start.
const startOf=(period?:string)=>{const m=period?.match(/(\d{4})\.(\d{2})/);return m?{year:+m[1],month:+m[2]}:null;};
export function yearsOfExperience(entries:Entry[],now:Date):number|undefined{
 const starts=entries.filter(e=>e.kind==='experience').map(e=>startOf(e.period)).filter((s):s is {year:number;month:number}=>Boolean(s));
 if(!starts.length)return undefined;
 const first=starts.reduce((a,b)=>a.year<b.year||(a.year===b.year&&a.month<=b.month)?a:b);
 const full=now.getFullYear()-first.year-(now.getMonth()+1<first.month?1:0);
 return Math.max(1,full);
}
export function buildResume(data:Portfolio,now=new Date()):ResumeDoc{
 const entries=data.entries;
 const titleOf=(id:string)=>entries.find(e=>e.id===id)?.title??id.replace(/^skill:/,'');
 const skillsOf=(tags:string[])=>tags.filter(t=>entries.find(e=>e.id===t)?.kind==='skill'||t.startsWith('skill:')).map(titleOf);
 const parentsOf=(e:Entry)=>e.parents??(e.parent?[e.parent]:[]);
 const experiences=entries.filter(e=>e.kind==='experience');
 const projects=entries.filter(e=>e.kind==='project');
 const featured=projects.filter(p=>p.featured),others=projects.filter(p=>!p.featured);
 const skills=entries.filter(e=>e.kind==='skill');
 const dedupe=(list:string[])=>[...new Set(list)];
 const sections:ResumeSection[]=[];
 if(experiences.length)sections.push({title:'경력',layout:'block',items:experiences.map(e=>({
  title:e.title,meta:periodOf(e.period),role:cleanRole(e.role),summary:e.body[0],bullets:e.body.slice(1,1+FEATURED_BULLETS),
  // Own skills first, then the skills of the projects done there, so the line reads company-level → project-level.
  stack:dedupe([...skillsOf(e.tags),...projects.filter(p=>parentsOf(p).includes(e.id)).flatMap(p=>skillsOf(p.tags))]).slice(0,STACK_LIMIT)}))});
 if(featured.length)sections.push({title:'주요 프로젝트',layout:'block',items:featured.map(p=>({
  title:p.title,meta:periodOf(p.period),role:cleanRole(p.role),company:parentsOf(p).map(titleOf).filter(t=>experiences.some(e=>e.title===t)).join(' · ')||undefined,summary:p.subtitle,
  bullets:narrativeSections(p).process.flatMap(b=>b.lines).slice(0,FEATURED_BULLETS),stack:skillsOf(p.tags),url:p.url??p.links?.[0]}))});
 if(others.length)sections.push({title:'기타 프로젝트',layout:'compact',items:others.map(p=>({title:p.title,meta:periodOf(p.period),summary:p.subtitle,bullets:[]}))});
 if(skills.length){const groups=new Map<string,string[]>();for(const s of skills){const g=s.subtitle||'기타';groups.set(g,[...(groups.get(g)??[]),s.title]);}sections.push({title:'기술',layout:'table',items:[...groups].map(([group,names])=>({label:group,title:names.join(' · '),bullets:[]}))});}
 if(data.credentials?.length)sections.push({title:'학력 · 자격',layout:'table',items:data.credentials.map(c=>({label:/학사|석사|박사|대학교|대학원/.test(c.title+' '+c.issuer)?'학력':'자격',title:c.title,summary:c.issuer,meta:c.date?c.date.slice(0,7).replace('-','.'):undefined,bullets:[]}))});
 const contacts=[...(data.email?[{label:data.email,url:`mailto:${data.email}`}]:[]),...(data.links??[]).map(l=>({label:l.url,url:l.url}))];
 return {name:data.name,role:data.role,years:yearsOfExperience(entries,now),intro:data.intro,contacts,sections,generatedAt:now.toISOString().slice(0,10)};
}
// Greedy word wrap that also breaks inside a single over-long token (URLs, long Korean words).
export function wrapText(text:string,maxWidth:number,measure:(s:string)=>number):string[]{
 const lines:string[]=[];let line='';
 const push=()=>{if(line.trim())lines.push(line.trim());line='';};
 for(const word of text.split(/\s+/).filter(Boolean)){
  const candidate=line?`${line} ${word}`:word;
  if(measure(candidate)<=maxWidth){line=candidate;continue;}
  if(line)push();
  if(measure(word)<=maxWidth){line=word;continue;}
  let chunk='';for(const ch of word){if(measure(chunk+ch)>maxWidth&&chunk){lines.push(chunk);chunk='';}chunk+=ch;}line=chunk;
 }
 push();return lines;
}
