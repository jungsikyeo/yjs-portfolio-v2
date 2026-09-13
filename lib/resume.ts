import {type Portfolio,type Entry,narrativeSections} from './portfolio';
// The résumé is a projection of the same Notion data the site renders: profile, every experience,
// featured projects with their first work-log lines, the rest of the projects as one-liners, skills
// grouped the way the Skills tab groups them, then credentials. Everything here is layout-agnostic so
// it can be unit-tested; the PDF generator only turns this model into pages.
export type ResumeItem={title:string;meta?:string;summary?:string;bullets:string[]};
export type ResumeSection={title:string;items:ResumeItem[];compact?:boolean};
export type ResumeDoc={name:string;role:string;intro:string;contacts:string[];sections:ResumeSection[];generatedAt:string};
export const FEATURED_BULLETS=3;
const cleanRole=(role?:string)=>role?.replace(/\s*[·]\s*/g,' · ').trim();
const meta=(entry:Entry)=>[entry.period,cleanRole(entry.role)].filter(Boolean).join('  ·  ');
export function buildResume(data:Portfolio,now=new Date()):ResumeDoc{
 const experiences=data.entries.filter(e=>e.kind==='experience');
 const projects=data.entries.filter(e=>e.kind==='project');
 const featured=projects.filter(p=>p.featured),others=projects.filter(p=>!p.featured);
 const skills=data.entries.filter(e=>e.kind==='skill');
 const sections:ResumeSection[]=[];
 if(experiences.length)sections.push({title:'경력',items:experiences.map(e=>({title:e.title,meta:meta(e),summary:e.body[0],bullets:e.body.slice(1,1+FEATURED_BULLETS)}))});
 if(featured.length)sections.push({title:'주요 프로젝트',items:featured.map(p=>({title:p.title,meta:meta(p),summary:p.subtitle,bullets:narrativeSections(p).process.flatMap(b=>b.lines).slice(0,FEATURED_BULLETS)}))});
 if(others.length)sections.push({title:'기타 프로젝트',compact:true,items:others.map(p=>({title:p.title,meta:p.period,summary:p.subtitle,bullets:[]}))});
 if(skills.length){const groups=new Map<string,string[]>();for(const s of skills){const g=s.subtitle||'기타';groups.set(g,[...(groups.get(g)??[]),s.title]);}sections.push({title:'기술',compact:true,items:[...groups].map(([group,names])=>({title:group,summary:names.join(', '),bullets:[]}))});}
 if(data.credentials?.length)sections.push({title:'학력 · 자격',compact:true,items:data.credentials.map(c=>({title:c.title,meta:c.date?c.date.slice(0,7).replace('-','.'):undefined,summary:c.issuer,bullets:[]}))});
 const contacts=[data.email,...(data.links??[]).map(l=>l.url.replace(/^https?:\/\//,''))].filter((v):v is string=>Boolean(v));
 return {name:data.name,role:data.role,intro:data.intro,contacts,sections,generatedAt:now.toISOString().slice(0,10)};
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
