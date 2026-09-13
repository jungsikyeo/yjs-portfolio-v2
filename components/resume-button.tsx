'use client';
import {useState} from 'react';
import {FileDown,Loader2} from 'lucide-react';
import type {Portfolio} from '@/lib/portfolio';
// Builds the A4 PDF in the browser from the portfolio the page already has and hands it to the user
// as a download. The generator and fonts load lazily so first paint pays nothing for them.
export function ResumeButton({data}:{data:Portfolio}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){
  setBusy(true);setError('');
  try{
   // After a deploy, a page loaded earlier still points at the previous build's chunk names; those
   // now 404. Reload once so the fresh page picks up the current chunks instead of showing an error.
   const modules=await Promise.all([import('@/lib/resume'),import('@/lib/resume-pdf')]).catch(e=>{
    if(!sessionStorage.getItem('resume-reloaded')){sessionStorage.setItem('resume-reloaded','1');location.reload();return null;}
    throw e;});
   if(!modules)return;
   sessionStorage.removeItem('resume-reloaded');
   const [{buildResume},{renderResume}]=modules;
   const bytes=await renderResume(buildResume(data));
   const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/pdf'}));
   const a=document.createElement('a');a.href=url;a.download=`${data.name.replace(/\s+/g,'')}_이력서_${new Date().toISOString().slice(0,10)}.pdf`;document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10_000);
  }catch(e){console.error(e);setError('이력서를 만들지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');}
  finally{setBusy(false);}
 }
 return <><button type="button" className="contact-button" onClick={download} disabled={busy} aria-busy={busy}>{busy?<Loader2 size={13} className="spin"/>:<FileDown size={13}/>}{busy?'만드는 중…':'이력서 PDF'}</button>{error&&<span className="contact-inline-error" role="alert">{error}</span>}</>;
}
