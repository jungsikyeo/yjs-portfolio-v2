import {type Portfolio} from './portfolio';
import {NotionError} from './notion-client';
export type Snapshot={data:Portfolio|null;nextAttempt:number};
export type Store={read():Promise<Snapshot|null>;write(value:Snapshot):Promise<void>;lock(now:number):Promise<boolean>};
export async function synchronize(store:Store,load:()=>Promise<Portfolio>,now=Date.now(),ttl=300000):Promise<Portfolio>{
 const started=Date.now();
 const old=await store.read();
 const failed=(message:string):Portfolio=>old?.data?{...old.data,status:'stale',message}:{name:'이력을 불러오지 못했습니다',role:'NOTION CONNECTION',intro:'노션 연결과 페이지 권한을 확인해 주세요.',entries:[],demo:false,syncedAt:null,status:'error',message};
 if(old?.nextAttempt&&now<old.nextAttempt)return old.data??failed('다음 자동 재시도를 기다리고 있습니다.');
 if(!await store.lock(now))return old?.data??failed('첫 동기화가 진행 중입니다.');
 try{const data=await load();data.syncedAt=new Date(now+Date.now()-started).toISOString();data.status='ready';await store.write({data,nextAttempt:now+ttl});return data}catch(error){
  const denied=error instanceof NotionError&&[401,403,404,410].includes(error.status);
  // Explicit access removal must not keep serving previously cached private content.
  const result=denied?{...failed('페이지 접근 권한이 없거나 삭제되었습니다.'),entries:[],name:'이력 접근이 중단되었습니다',intro:'원본 페이지와 연결 권한을 확인해 주세요.',status:'error' as const,syncedAt:null}:failed('노션 갱신에 실패했습니다. 자동으로 다시 시도합니다.');
  await store.write({data:result,nextAttempt:now+Math.max(60000,error instanceof NotionError?error.retryAfter:0)});return result
 }
}
