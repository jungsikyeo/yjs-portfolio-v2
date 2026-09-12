import {rich,safeUrl,type Block,type PageRecord} from './notion-parser';
import {type Entry,type Portfolio} from './portfolio';
import {createNotionClient,NotionError} from './notion-client';
export type DatabaseConfig={PROFILE:string;EXPERIENCE:string;PROJECT:string;SKILL:string;CREDENTIAL?:string};
type Row=PageRecord & {archived?:boolean;in_trash?:boolean};
// Notion-hosted files expose a signed URL that expires within an hour; the file id in its path is stable and becomes the R2 key. External links are served as-is.
function screenshotsOf(p:Props){return ((p.screenshots?.files??[]) as any[]).flatMap(f=>{if(f.type==='external'){const url=safeUrl(f.external?.url);return url?[{key:'',name:f.name??'',src:url}]:[]}const url=f.file?.url as string|undefined;const key=url?.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[^/?]+(?:\?|$)/)?.[1];return url&&key?[{key,name:f.name??'',src:`/api/screenshots/${key}`}]:[]})}
type Props=Record<string,any>;
const text=(p:Props,k:string)=>rich(p[k]?.title??p[k]?.rich_text);
const plain=(bs:Block[]):string[]=>bs.flatMap(b=>{const v=b[b.type] as any;return [rich(v?.rich_text),...(v?.cells?.map(rich)??[]),...plain(b.children??[])].filter(Boolean)});
const period=(p:Props)=>{const d=p.period?.date;return d?`${d.start.slice(0,7).replace('-','.')} — ${d.end?d.end.slice(0,7).replace('-','.'):'현재'}`:''};
const names=(p:Props)=>p.stack?.multi_select?.map((v:any)=>v.name)??[];
const same=(a:string,b:string)=>a.replaceAll('-','')===b.replaceAll('-','');
export async function loadWorkspace(client:ReturnType<typeof createNotionClient>,root:string,config:DatabaseConfig):Promise<Portfolio>{
 const rootPage=await client.request(`pages/${root}`);if(rootPage.archived||rootPage.in_trash)throw new NotionError(410);
 const buckets:Record<string,{page:Row;body:string[]}[]>={};
 for(const [kind,id] of Object.entries(config)){
  if(!id)continue;const db=await client.request(`databases/${id}`);
  if(db.archived||db.in_trash)throw new NotionError(410);
  if(db.parent?.type!=='page_id'||!same(db.parent.page_id,root))throw new Error('Configured database is outside the approved root.');
  const rows:Row[]=[];for(const source of db.data_sources??[]){let cursor;do{const batch=await client.request(`data_sources/${source.id}/query`,{page_size:100,...(cursor?{start_cursor:cursor}:{})});rows.push(...batch.results);cursor=batch.has_more?batch.next_cursor:undefined;}while(cursor)}
  buckets[kind]=[];for(const page of rows.sort((a,b)=>(a.properties.order as any)?.number-(b.properties.order as any)?.number)){
   if(page.archived||page.in_trash||page.properties.Published?.checkbox===false)continue;
   // These database IDs were explicitly supplied as portfolio sources. An optional Published=false opts a row out.
   buckets[kind].push({page,body:plain(await client.blocks(page.id))});
  }
 }
 const profile=buckets.PROFILE?.[0];if(!profile)throw new Error('Profile is missing.');
 const p=profile.page.properties as Props;const entries:Entry[]=[{id:profile.page.id,kind:'person',title:text(p,'name'),subtitle:text(p,'headline'),body:[text(p,'summary'),...profile.body].filter(Boolean),tags:[]}];
 const skills=new Map<string,Entry>();
 for(const {page,body} of buckets.SKILL??[]){const p=page.properties as Props;const e:Entry={id:page.id,kind:'skill',title:text(p,'name'),subtitle:p.category?.select?.name??'기술',body,tags:[]};entries.push(e);skills.set(e.title,e)}
 const mapSkills=(values:string[])=>values.map(title=>{let skill=skills.get(title);if(!skill){skill={id:`skill:${title}`,kind:'skill',title,subtitle:'경력·프로젝트 사용 기술',body:[],tags:[]};entries.push(skill);skills.set(title,skill)}return skill.id});
 for(const {page,body} of buckets.EXPERIENCE??[]){const p=page.properties as Props;entries.push({id:page.id,kind:'experience',title:text(p,'company'),subtitle:[text(p,'role'),period(p)].filter(Boolean).join(' · '),body:[text(p,'summary'),...body].filter(Boolean),tags:mapSkills(names(p)),parent:profile.page.id,period:period(p),category:p.domain?.select?.name??'',role:text(p,'role'),featured:p.featured?p.featured.checkbox===true:undefined})}
 for(const {page,body} of buckets.PROJECT??[]){const p=page.properties as Props;const parents=p.experience?.relation??[];const links=[...text(p,'repoUrls').split('\n'),p.demoUrl?.url,p.docsUrl?.url].map(safeUrl).filter(Boolean) as string[];entries.push({id:page.id,kind:'project',title:text(p,'title'),subtitle:text(p,'oneLiner'),body:[text(p,'role')?`역할 · ${text(p,'role')}`:'',period(p)?`기간 · ${period(p)}`:'',...body,text(p,'achievements')?`성과 · ${text(p,'achievements')}`:''].filter(Boolean),tags:mapSkills(names(p)),parent:parents[0]?.id,parents:parents.map((r:{id:string})=>r.id),screenshots:screenshotsOf(p),featured:p.featured?.checkbox===true,period:period(p),role:text(p,'role'),url:links[0],links})}
 const links=[['GitHub',p.github?.url],['LinkedIn',p.linkedin?.url],['Blog',p.blog?.url]].filter(([,url])=>safeUrl(url)).map(([label,url])=>({label,url:safeUrl(url)!}));const email=p.email?.email;
 const credentials=(buckets.CREDENTIAL??[]).map(({page})=>{const p=page.properties as Props;return {title:text(p,'title'),issuer:text(p,'issuer'),date:p.date?.date?.start??''}});
 if(!entries[0].title||!entries[0].subtitle)throw new Error('Required profile properties are missing.');
 return {name:entries[0].title,role:entries[0].subtitle,intro:text(p,'summary'),entries,demo:false,syncedAt:null,status:'ready',links,email:typeof email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:undefined,credentials};
}
