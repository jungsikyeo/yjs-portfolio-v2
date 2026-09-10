import {type Block,type PageRecord,rich,normalizePage,normalizeDatabase} from './notion-parser';
export class NotionError extends Error{constructor(public status:number,public retryAfter=0){super(`Notion API ${status}`)}}
export function createNotionClient(token:string,fetcher:typeof fetch=fetch,sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))){
 let last=0; const deadline=Date.now()+90000;
 async function request(path:string,body?:unknown):Promise<any>{
  for(let attempt=0;attempt<4;attempt++){
   if(Date.now()>deadline)throw new NotionError(503);
   await sleep(Math.max(0,350-(Date.now()-last)));last=Date.now();let res:Response;
   try{res=await fetcher(`https://api.notion.com/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2026-03-11','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)})}catch{if(attempt===3)throw new NotionError(503);await sleep(500*2**attempt);continue}
   if(res.ok)return res.json();const wait=Number(res.headers.get('retry-after')??0)*1000;const retry=[429,529,500,502,503,504].includes(res.status);
   if(!retry||attempt===3||wait>10000)throw new NotionError(res.status,wait);
   await sleep(Math.max(wait,500*2**attempt)+Math.random()*200);
  }throw new NotionError(503)
 }
 async function blocks(id:string,depth=0,budget={count:0}):Promise<Block[]>{
  if(depth>30)throw new Error('문서 중첩 한도를 초과했습니다.');let cursor:string|undefined;const all:Block[]=[];
  do{const response=await request(`blocks/${encodeURIComponent(id)}/children?page_size=100${cursor?`&start_cursor=${encodeURIComponent(cursor)}`:''}`);for(const b of response.results as Block[]){if(++budget.count>5000)throw new Error('문서 블록 한도를 초과했습니다.');
   // Do not traverse linked pages, child pages/databases, or synced originals outside this explicit root.
   if(['child_page','child_database','link_to_page','synced_block'].includes(b.type))continue;
   if(b.has_children)b.children=await blocks(b.id,depth+1,budget);all.push(b)}cursor=response.has_more?response.next_cursor:undefined;}while(cursor);return all
 }
 async function load(root:string){
  let page;try{page=await request(`pages/${encodeURIComponent(root)}`)}catch(e){if(!(e instanceof NotionError)||![400,404].includes(e.status))throw e;}
  if(page){if(page.archived||page.in_trash)throw new NotionError(410);const title=rich((Object.values(page.properties) as any[]).find(v=>v.type==='title')?.title);return normalizePage(title,await blocks(root))}
  const database=await request(`databases/${encodeURIComponent(root)}`);const records:{page:PageRecord;blocks:Block[]}[]=[];
  for(const source of database.data_sources??[]){let cursor;do{const batch=await request(`data_sources/${source.id}/query`,{page_size:100,...(cursor?{start_cursor:cursor}:{})});for(const row of batch.results as PageRecord[]){if(row.properties.Published?.checkbox===true)records.push({page:row,blocks:await blocks(row.id)})}cursor=batch.has_more?batch.next_cursor:undefined}while(cursor)}
  return normalizeDatabase(rich(database.title),records)
 }
 return {load,blocks,request};
}
