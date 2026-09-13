'use client';
import {useState,type FormEvent} from 'react';
import {Mail,Send,ArrowUpRight} from 'lucide-react';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {validateContact,LIMITS} from '@/lib/contact';
// In-site contact form. Validation runs locally first for instant feedback, then again on the server.
// The mailto link stays as a fallback for people who prefer their own mail client.
export function ContactForm({email,open,onOpenChange}:{email?:string;open:boolean;onOpenChange:(open:boolean)=>void}){
 const [state,setState]=useState<'idle'|'sending'|'sent'|'saved'|'error'>('idle'),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const form=e.currentTarget,payload=Object.fromEntries(new FormData(form).entries());
  const checked=validateContact(payload);
  if(!checked.ok){setError(checked.error==='honeypot'?'':checked.error);return;}
  setError('');setState('sending');
  try{
   const res=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const body=await res.json().catch(()=>({})) as {ok?:boolean;delivered?:boolean;error?:string};
   if(!res.ok||!body.ok){setState('error');setError(body.error??'전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');return;}
   setState(body.delivered===false?'saved':'sent');form.reset();
  }catch{setState('error');setError('네트워크 오류로 전송하지 못했습니다.');}
 }
 return <Sheet open={open} onOpenChange={v=>{onOpenChange(v);if(!v){setState('idle');setError('');}}}><SheetContent className="detail-sheet contact-sheet"><SheetHeader><span className="tiny-label">CONTACT</span><SheetTitle>연락하기</SheetTitle><SheetDescription>내용을 남기면 메일로 바로 전달됩니다. 회신은 적어 주신 이메일로 드립니다.</SheetDescription></SheetHeader>
  <div className="detail-body">
  {state==='sent'||state==='saved'?<div className="contact-done" role="status"><Mail size={22}/><h4>{state==='sent'?'전달됐습니다':'접수됐습니다'}</h4><p>{state==='sent'?'메일이 발송됐습니다. 빠르게 회신드리겠습니다.':'메시지가 저장됐습니다. 확인 후 회신드리겠습니다.'}</p><button type="button" className="contact-submit" onClick={()=>onOpenChange(false)}>닫기</button></div>
  :<form className="contact-form" onSubmit={submit} noValidate>
   <label><span>이름</span><input name="name" required maxLength={LIMITS.name} autoComplete="name" placeholder="홍길동"/></label>
   <label><span>이메일</span><input name="email" type="email" required maxLength={LIMITS.email} autoComplete="email" placeholder="reply@company.com"/></label>
   <label><span>소속 <small>선택</small></span><input name="company" maxLength={LIMITS.company} autoComplete="organization" placeholder="회사 · 팀"/></label>
   <label><span>내용</span><textarea name="message" required minLength={LIMITS.minMessage} maxLength={LIMITS.message} rows={7} placeholder="어떤 일로 연락 주시는지 적어 주세요."/></label>
   <div className="contact-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
   {error&&<p className="contact-error" role="alert">{error}</p>}
   <div className="contact-actions"><button type="submit" className="contact-submit" disabled={state==='sending'}><Send size={13}/>{state==='sending'?'보내는 중…':'보내기'}</button>{email&&<a href={`mailto:${email}`} className="contact-alt">메일 앱으로 보내기 <ArrowUpRight size={12}/></a>}</div>
  </form>}
  </div></SheetContent></Sheet>;
}
