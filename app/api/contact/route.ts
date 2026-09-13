import {env} from 'cloudflare:workers';
import {validateContact,contactEmail} from '@/lib/contact';
import {getPortfolio} from '@/lib/notion';
// Messages are always persisted to D1 first, then relayed through Resend's free tier when a key is
// configured. Sending is best-effort: a failed relay still leaves the message in the table.
const runtime=env as unknown as {DB?:D1Database;RESEND_API_KEY?:string;CONTACT_TO?:string;CONTACT_FROM?:string;CONTACT_SALT?:string};
const SITE='portfolio.yeojs.dev';
const PER_IP_HOUR=5,GLOBAL_DAY=40;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function ipHash(request:Request){const ip=request.headers.get('CF-Connecting-IP')??'unknown';const bytes=new TextEncoder().encode(`${runtime.CONTACT_SALT??'portfolio'}:${ip}`);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].slice(0,16).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function POST(request:Request){
 const db=runtime.DB;
 if(!db)return json({ok:false,error:'문의 기능이 아직 준비되지 않았습니다.'},503);
 let raw:unknown;try{raw=await request.json();}catch{return json({ok:false,error:'요청 형식이 올바르지 않습니다.'},400);}
 const checked=validateContact(raw);
 if(!checked.ok)return checked.error==='honeypot'?json({ok:true}):json({ok:false,error:checked.error},400);
 const value=checked.value,now=Date.now(),ip=await ipHash(request);
 const [perIp,global]=await Promise.all([
  db.prepare('SELECT COUNT(*) AS n FROM contact_messages WHERE ip_hash=? AND created_at>?').bind(ip,now-3600_000).first<{n:number}>(),
  db.prepare('SELECT COUNT(*) AS n FROM contact_messages WHERE created_at>?').bind(now-86400_000).first<{n:number}>()]);
 if((perIp?.n??0)>=PER_IP_HOUR||(global?.n??0)>=GLOBAL_DAY)return json({ok:false,error:'잠시 후 다시 시도해 주세요.'},429);
 const inserted=await db.prepare('INSERT INTO contact_messages (created_at,ip_hash,name,email,company,message,sent) VALUES (?,?,?,?,?,?,0)').bind(now,ip,value.name,value.email,value.company??null,value.message).run();
 const id=inserted.meta.last_row_id;
 const to=runtime.CONTACT_TO??(await getPortfolio()).email;
 if(!runtime.RESEND_API_KEY||!to)return json({ok:true,delivered:false});
 const {subject,text}=contactEmail(value,SITE);
 const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${runtime.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:runtime.CONTACT_FROM??`Portfolio <onboarding@resend.dev>`,to:[to],reply_to:value.email,subject,text})}).catch(()=>null);
 if(sent?.ok){await db.prepare('UPDATE contact_messages SET sent=1 WHERE id=?').bind(id).run();return json({ok:true,delivered:true});}
 console.error('contact relay failed',sent?.status,await sent?.text().catch(()=>''));
 return json({ok:true,delivered:false});
}
