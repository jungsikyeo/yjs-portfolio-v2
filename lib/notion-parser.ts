import type { Entry, Kind, Portfolio } from './portfolio';
export type RichText={plain_text?:string;text?:{content?:string}};
export type Block={id:string;type:string;has_children?:boolean;children?:Block[];[key:string]:unknown};
export const rich=(v:unknown):string=>Array.isArray(v)?(v as RichText[]).map(t=>t.plain_text??t.text?.content??'').join(''):'';
export function safeUrl(value:string|undefined){if(!value)return undefined;try{const u=new URL(value);return ['https:','http:','mailto:'].includes(u.protocol)?u.href:undefined}catch{return undefined}}
function blockText(b:Block):string{const value=b[b.type] as {rich_text?:RichText[];cells?:RichText[][]}|undefined;return rich(value?.rich_text)||(value?.cells?.map(rich).join(' | ')??'')}
const sections:Record<string,Kind>={'experience':'experience','경력':'experience','경력 사항':'experience','projects':'project','프로젝트':'project','skills':'skill','기술':'skill','기술 스택':'skill'};
export function normalizePage(title:string,blocks:Block[]):Portfolio{
 const entries:Entry[]=[];const intro:string[]=[];let kind:Kind|undefined,current:Entry|undefined;let name=title,role='PORTFOLIO';
 const flat=(bs:Block[]):Block[]=>bs.flatMap(b=>[b,...flat(b.children??[])]);
 for(const b of flat(blocks)){
  const text=blockText(b).trim();if(!text)continue;
  const section=sections[text.toLowerCase()];if(b.type.startsWith('heading')&&section){kind=section;current=undefined;continue}
  if(b.type.startsWith('heading')&&kind){current={id:b.id,kind,title:text,subtitle:'',body:[],tags:[],...(kind==='experience'?{parent:'profile'}:{})};entries.push(current);continue}
  if(!current){if(/^이름\s*[:：]/.test(text))name=text.replace(/^이름\s*[:：]\s*/,'');else if(/^직무\s*[:：]/.test(text))role=text.replace(/^직무\s*[:：]\s*/,'');else if(kind==='skill'){const e={id:b.id,kind,title:text,subtitle:'등록된 기술',body:[],tags:[]};entries.push(e)}else intro.push(text);continue}
  current.body.push(text);
  if(/^(역할|기간|직무)\s*[:：]/.test(text))current.subtitle=[current.subtitle,text].filter(Boolean).join(' · ');
  if(/^(기술|기술 스택|사용 기술)\s*[:：]/.test(text))current.tags=text.replace(/^[^:：]+[:：]\s*/,'').split(/[,，]/).map(s=>s.trim()).filter(Boolean);
  if(/^(링크|URL)\s*[:：]/i.test(text))current.url=safeUrl(text.replace(/^[^:：]+[:：]\s*/,''));
 }
 // Relationships are explicit; never infer participation from similar titles or technology mentions.
 for(const e of entries.filter(e=>e.kind==='project')){const company=e.body.find(t=>/^(경력|회사)\s*[:：]/.test(t))?.replace(/^[^:：]+[:：]\s*/,'');const parent=entries.find(n=>n.kind==='experience'&&n.title===company);if(parent)e.parent=parent.id;}
 const skills=new Map(entries.filter(e=>e.kind==='skill').map(e=>[e.title,e]));
 for(const e of [...entries])e.tags=e.tags.map(title=>{let skill=skills.get(title);if(!skill){skill={id:`skill:${title}`,kind:'skill',title,subtitle:'프로젝트에서 사용',body:[],tags:[]};entries.push(skill);skills.set(title,skill)}return skill.id});
 entries.unshift({id:'profile',kind:'person',title:name,subtitle:role,body:intro,tags:[]});
 return {name,role,intro:intro.join('\n'),entries,demo:false,syncedAt:null,status:'ready'};
}
export type PageRecord={id:string;properties:Record<string,{type:string;title?:RichText[];rich_text?:RichText[];checkbox?:boolean;select?:{name:string}|null;multi_select?:{name:string}[];url?:string;date?:{start:string;end?:string|null}|null;relation?:{id:string}[]}>};
export function normalizeDatabase(title:string,records:{page:PageRecord;blocks:Block[]}[]):Portfolio{
 const entries:Entry[]=records.map(({page,blocks})=>{const p=page.properties;const t=rich(Object.values(p).find(v=>v.type==='title')?.title);const type=p.Type?.select?.name?.toLowerCase()??'';const kind=sections[type]??(['person','experience','project','skill'].includes(type)?type as Kind:'project');const text=normalizePage(t,blocks);return {id:page.id,kind,title:t,subtitle:rich(p.Role?.rich_text),body:[...text.entries[0].body,...text.entries.slice(1).flatMap(e=>[e.title,...e.body])],tags:p.Skills?.multi_select?.map(s=>s.name)??[],parent:p.Parent?.relation?.[0]?.id,url:safeUrl(p.URL?.url)}});
 const skills=new Map(entries.filter(e=>e.kind==='skill').map(e=>[e.title,e]));for(const e of [...entries])e.tags=e.tags.map(title=>{let s=skills.get(title);if(!s){s={id:`skill:${title}`,kind:'skill',title,subtitle:'프로젝트에서 사용',body:[],tags:[]};entries.push(s);skills.set(title,s)}return s.id});
 const person=entries.find(e=>e.kind==='person');return {name:person?.title??title,role:person?.subtitle??'PORTFOLIO',intro:person?.body.join('\n')??'',entries,demo:false,syncedAt:null,status:'ready'};
}
