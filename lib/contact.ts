// Validation for the in-site contact form. Kept free of runtime bindings so it can be unit-tested and
// reused by both the form (instant feedback) and the API route (the actual gate).
export type ContactInput={name:string;email:string;company?:string;message:string;website?:string};
export type ContactResult={ok:true;value:ContactInput}|{ok:false;error:string};
export const LIMITS={name:60,email:120,company:80,message:2000,minMessage:10};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim().slice(0,max):'';
export function validateContact(raw:unknown):ContactResult{
 const r=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>;
 // Honeypot: real users never see or fill this field. Bots that do are answered with a quiet success.
 if(typeof r.website==='string'&&r.website.trim())return {ok:false,error:'honeypot'};
 const value:ContactInput={name:clean(r.name,LIMITS.name),email:clean(r.email,LIMITS.email),company:clean(r.company,LIMITS.company)||undefined,message:clean(r.message,LIMITS.message)};
 if(!value.name)return {ok:false,error:'이름을 입력해 주세요.'};
 if(!EMAIL.test(value.email))return {ok:false,error:'회신받을 이메일 주소를 확인해 주세요.'};
 if(value.message.length<LIMITS.minMessage)return {ok:false,error:`내용은 ${LIMITS.minMessage}자 이상 적어 주세요.`};
 return {ok:true,value};
}
export function contactEmail(value:ContactInput,site:string){
 const subject=`[${site}] ${value.name}${value.company?` (${value.company})`:''} 님의 연락`;
 const text=[`이름: ${value.name}`,`이메일: ${value.email}`,value.company?`소속: ${value.company}`:'',``,value.message,``,`— ${site} 연락하기 폼에서 전송`].filter((l,i,a)=>!(l===''&&a[i-1]==='')).join('\n');
 return {subject,text};
}
