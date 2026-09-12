import {cache} from 'react';
import {env} from 'cloudflare:workers';
import {loadWorkspace,type BodyCache} from './notion-workspace';
import {demo,type Portfolio} from './portfolio';
import {createNotionClient} from './notion-client';
import {synchronize,type Snapshot,type Store} from './sync';
const runtime=env as unknown as {NOTION_TOKEN?:string;NOTION_ROOT_ID?:string;NOTION_PUBLISH_ENABLED?:string;NOTION_DB_PROFILE?:string;NOTION_DB_EXPERIENCE?:string;NOTION_DB_PROJECT?:string;NOTION_DB_SKILL?:string;NOTION_DB_CREDENTIAL?:string;DB?:D1Database};async function readPortfolio():Promise<Portfolio>{
 if(!runtime.NOTION_TOKEN||runtime.NOTION_PUBLISH_ENABLED!=='true')return demo;
 const root=runtime.NOTION_ROOT_ID??'3c404ce782f080658de5e1e63f28e24d';
 const db=runtime.DB;if(!db)return {name:'콘텐츠 저장소 연결 대기',role:'NOTION CONNECTION',intro:'서버의 DB 연결을 확인해 주세요.',entries:[],demo:false,syncedAt:null,status:'error'};
 const store:Store={
  async read(){const row=await db.prepare('SELECT payload, next_attempt FROM content_cache WHERE id = ?').bind(root).first<{payload:string|null;next_attempt:number}>();return row?{data:row.payload?JSON.parse(row.payload):null,nextAttempt:row.next_attempt}:null},
  async lock(now){await db.prepare('INSERT OR IGNORE INTO content_cache (id, payload, next_attempt, lease_until) VALUES (?, NULL, 0, 0)').bind(root).run();const r=await db.prepare('UPDATE content_cache SET lease_until = ? WHERE id = ? AND lease_until < ?').bind(now+120000,root,now).run();return r.meta.changes===1},
  async write(value:Snapshot){await db.prepare('UPDATE content_cache SET payload = ?, next_attempt = ?, lease_until = 0 WHERE id = ?').bind(JSON.stringify(value.data),value.nextAttempt,root).run()}
 };
 try{return await synchronize(store,()=>{const client=createNotionClient(runtime.NOTION_TOKEN!);if(!(runtime.NOTION_DB_PROFILE&&runtime.NOTION_DB_EXPERIENCE&&runtime.NOTION_DB_PROJECT&&runtime.NOTION_DB_SKILL))return client.load(root);return loadWithBodyCache(db,cache=>loadWorkspace(client,root,{PROFILE:runtime.NOTION_DB_PROFILE!,EXPERIENCE:runtime.NOTION_DB_EXPERIENCE!,PROJECT:runtime.NOTION_DB_PROJECT!,SKILL:runtime.NOTION_DB_SKILL!,CREDENTIAL:runtime.NOTION_DB_CREDENTIAL},cache))})}catch{return {name:'콘텐츠 저장소 오류',role:'NOTION CONNECTION',intro:'저장소 연결이 복구되면 자동으로 다시 시도합니다.',entries:[],demo:false,syncedAt:null,status:'error'}}
}

// One D1 read before the load and one batched write after it; pages not seen in this load are dropped from the cache.
async function loadWithBodyCache(db:D1Database,load:(cache:BodyCache)=>Promise<Portfolio>):Promise<Portfolio>{
 type Cached={edited:string;body:string[]};
 const stored=new Map<string,Cached>();
 try{const rows=await db.prepare('SELECT id, edited, body FROM page_bodies').all<{id:string;edited:string;body:string}>();for(const r of rows.results)stored.set(r.id,{edited:r.edited,body:JSON.parse(r.body)})}catch(error){console.error('page body cache unavailable',error instanceof Error?error.message:error)}
 const seen=new Map<string,Cached>();
 const data=await load({get:id=>stored.get(id),set:(id,edited,body)=>seen.set(id,{edited,body})});
 const statements=[];
 for(const [id,value] of seen){const before=stored.get(id);if(!before||before.edited!==value.edited)statements.push(db.prepare('INSERT OR REPLACE INTO page_bodies (id, edited, body) VALUES (?, ?, ?)').bind(id,value.edited,JSON.stringify(value.body)))}
 const stale=[...stored.keys()].filter(id=>!seen.has(id));
 if(stale.length)statements.push(db.prepare(`DELETE FROM page_bodies WHERE id IN (${stale.map(()=>'?').join(',')})`).bind(...stale));
 if(statements.length){try{await db.batch(statements)}catch(error){console.error('page body cache write failed',error instanceof Error?error.message:error)}}
 return data;
}

export const getPortfolio=cache(readPortfolio);
