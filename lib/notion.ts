import {cache} from 'react';
import {env} from 'cloudflare:workers';
import {loadWorkspace} from './notion-workspace';
import {demo,type Portfolio} from './portfolio';
import {createNotionClient} from './notion-client';
import {synchronize,type Snapshot,type Store} from './sync';
const runtime=env as unknown as {NOTION_TOKEN?:string;NOTION_ROOT_ID?:string;NOTION_PUBLISH_ENABLED?:string;NOTION_DB_PROFILE?:string;NOTION_DB_EXPERIENCE?:string;NOTION_DB_PROJECT?:string;NOTION_DB_SKILL?:string;NOTION_DB_CREDENTIAL?:string;DB?:D1Database;BUCKET?:R2Bucket};
// Copy each new Notion screenshot into R2 while its signed URL is still valid, then forget the URL.
async function mirrorScreenshots(data:Portfolio,bucket:R2Bucket|undefined):Promise<Portfolio>{
 for(const entry of data.entries){
  if(!entry.screenshots?.length)continue;
  const kept=[];
  for(const shot of entry.screenshots){
   const {source,...rest}=shot;
   if(!source){kept.push(rest);continue}
   if(!bucket)continue;
   try{
    if(!await bucket.head(shot.key)){const res=await fetch(source);if(!res.ok||!res.body)throw new Error(`screenshot fetch ${res.status}`);await bucket.put(shot.key,res.body,{httpMetadata:{contentType:res.headers.get('content-type')??'application/octet-stream'}})}
    kept.push(rest);
   }catch(error){console.error('screenshot mirror failed',shot.key,error instanceof Error?error.message:error)}
  }
  entry.screenshots=kept;
 }
 return data;
}
async function readPortfolio():Promise<Portfolio>{
 if(!runtime.NOTION_TOKEN||runtime.NOTION_PUBLISH_ENABLED!=='true')return demo;
 const root=runtime.NOTION_ROOT_ID??'3c404ce782f080658de5e1e63f28e24d';
 const db=runtime.DB;if(!db)return {name:'콘텐츠 저장소 연결 대기',role:'NOTION CONNECTION',intro:'서버의 DB 연결을 확인해 주세요.',entries:[],demo:false,syncedAt:null,status:'error'};
 const store:Store={
  async read(){const row=await db.prepare('SELECT payload, next_attempt FROM content_cache WHERE id = ?').bind(root).first<{payload:string|null;next_attempt:number}>();return row?{data:row.payload?JSON.parse(row.payload):null,nextAttempt:row.next_attempt}:null},
  async lock(now){await db.prepare('INSERT OR IGNORE INTO content_cache (id, payload, next_attempt, lease_until) VALUES (?, NULL, 0, 0)').bind(root).run();const r=await db.prepare('UPDATE content_cache SET lease_until = ? WHERE id = ? AND lease_until < ?').bind(now+120000,root,now).run();return r.meta.changes===1},
  async write(value:Snapshot){await db.prepare('UPDATE content_cache SET payload = ?, next_attempt = ?, lease_until = 0 WHERE id = ?').bind(JSON.stringify(value.data),value.nextAttempt,root).run()}
 };
 try{return await synchronize(store,()=>{const client=createNotionClient(runtime.NOTION_TOKEN!);const loaded=runtime.NOTION_DB_PROFILE&&runtime.NOTION_DB_EXPERIENCE&&runtime.NOTION_DB_PROJECT&&runtime.NOTION_DB_SKILL?loadWorkspace(client,root,{PROFILE:runtime.NOTION_DB_PROFILE,EXPERIENCE:runtime.NOTION_DB_EXPERIENCE,PROJECT:runtime.NOTION_DB_PROJECT,SKILL:runtime.NOTION_DB_SKILL,CREDENTIAL:runtime.NOTION_DB_CREDENTIAL}):client.load(root);return loaded.then(data=>mirrorScreenshots(data,runtime.BUCKET))})}catch{return {name:'콘텐츠 저장소 오류',role:'NOTION CONNECTION',intro:'저장소 연결이 복구되면 자동으로 다시 시도합니다.',entries:[],demo:false,syncedAt:null,status:'error'}}
}

export const getPortfolio=cache(readPortfolio);
