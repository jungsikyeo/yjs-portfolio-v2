import {PDFDocument,PDFFont,PDFPage,rgb,type RGB} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {type ResumeDoc,type ResumeItem,wrapText} from './resume';
// Runs in the browser. Cloudflare's free Worker tier has a tight CPU budget, and font parsing is the
// expensive part, so the PDF is generated client-side from the same JSON the page already holds.
// The fonts are Pretendard trimmed to KS X 1001 Hangul plus Latin and served as static assets; they
// are embedded whole because fontkit's TrueType subsetter drops glyphs from this face, and stripped
// of OpenType layout tables because pdf-lib's advance widths ignore them (stray gaps after ':' and '-').
//
// Typography follows the "quiet document" print scale: name 24pt/700, section 12pt/650, item 11pt/650,
// body 9.5pt/450, meta 8.5pt/450, with hierarchy made by size, weight, spacing and hairlines only.
const A4={w:595.28,h:841.89},MARGIN={x:42,top:40,bottom:38};
const INK=rgb(.067,.094,.153),SECONDARY=rgb(.216,.255,.318),MUTED=rgb(.294,.333,.388),RULE=rgb(.82,.835,.859);
const T={name:{size:24,lh:1.1},section:{size:12,lh:1.25},item:{size:11,lh:1.35},body:{size:9.5,lh:1.5},meta:{size:8.5,lh:1.4}};
type Fonts={regular:PDFFont;semibold:PDFFont;bold:PDFFont};
async function loadFonts(pdf:PDFDocument):Promise<Fonts>{
 pdf.registerFontkit(fontkit);
 const [r,s,b]=await Promise.all(['Regular','SemiBold','Bold'].map(async w=>{const u=`/fonts/Pretendard-${w}-subset.ttf`;const res=await fetch(u);if(!res.ok)throw new Error(`font ${u} ${res.status}`);return res.arrayBuffer();}));
 return {regular:await pdf.embedFont(r,{subset:false}),semibold:await pdf.embedFont(s,{subset:false}),bold:await pdf.embedFont(b,{subset:false})};
}
// Characters outside the embedded subset would render as empty boxes; swap them for a space instead.
function sanitize(text:string,font:PDFFont){const set=font.getCharacterSet();return [...text].map(ch=>set.includes(ch.codePointAt(0)!)?ch:' ').join('');}
type Style={size:number;lh:number};
class Writer{
 page!:PDFPage;y=0;pageNo=0;
 constructor(private pdf:PDFDocument,private fonts:Fonts,private footerLabel:string){this.newPage();}
 get right(){return A4.w-MARGIN.x;}
 get width(){return A4.w-MARGIN.x*2;}
 newPage(){if(this.pageNo>0)this.footer();this.page=this.pdf.addPage([A4.w,A4.h]);this.pageNo++;this.y=A4.h-MARGIN.top;}
 footer(){const f=this.fonts.regular,s=7.5,label=sanitize(`${this.footerLabel}  ·  ${this.pageNo}`,f);this.page.drawText(label,{x:this.right-f.widthOfTextAtSize(label,s),y:MARGIN.bottom-16,size:s,font:f,color:MUTED});}
 ensure(height:number){if(this.y-height<MARGIN.bottom)this.newPage();}
 measure(text:string,font:PDFFont,size:number){return font.widthOfTextAtSize(sanitize(text,font),size);}
 // Draws wrapped text and returns the number of lines. `underline` marks a link the way print keeps it: a hairline, no URL appended.
 text(text:string,style:Style,font:PDFFont,{color=INK,x=MARGIN.x,width=this.width,underline=false,after=0}:{color?:RGB;x?:number;width?:number;underline?:boolean;after?:number}={}){
  const lines=wrapText(sanitize(text,font),width,s=>font.widthOfTextAtSize(s,style.size));const step=style.size*style.lh;
  for(const line of lines){this.ensure(step);const baseline=this.y-style.size*.85;this.page.drawText(line,{x,y:baseline,size:style.size,font,color});
   if(underline)this.page.drawLine({start:{x,y:baseline-1.6},end:{x:x+font.widthOfTextAtSize(line,style.size),y:baseline-1.6},thickness:.5,color});
   this.y-=step;}
  this.y-=after;return lines.length;
 }
 // A left text and a right-aligned meta on the same first line; the left wraps under itself if long.
 row(left:string,leftStyle:Style,leftFont:PDFFont,right:string|undefined,{underline=false}={}){
  const rightWidth=right?this.measure(right,this.fonts.regular,T.meta.size):0;
  this.ensure(leftStyle.size*leftStyle.lh);
  const top=this.y;
  this.text(left,leftStyle,leftFont,{width:this.width-rightWidth-12,underline});
  if(right)this.page.drawText(sanitize(right,this.fonts.regular),{x:this.right-rightWidth,y:top-leftStyle.size*.85,size:T.meta.size,font:this.fonts.regular,color:MUTED});
 }
 bullets(items:string[]){for(const b of items){const step=T.body.size*T.body.lh;this.ensure(step);this.page.drawText('•',{x:MARGIN.x+3,y:this.y-T.body.size*.85,size:T.body.size,font:this.fonts.regular,color:INK});this.text(b,T.body,this.fonts.regular,{x:MARGIN.x+14,width:this.width-14});}}
 rule(above=0,below=0){this.y-=above;this.ensure(below+1);this.page.drawLine({start:{x:MARGIN.x,y:this.y},end:{x:this.right,y:this.y},thickness:.5,color:RULE});this.y-=below;}
 gap(h:number){this.y-=h;}
 finish(){this.footer();}
}
const SECTION_GAP=13,ITEM_GAP=9;
function block(w:Writer,f:Fonts,item:ResumeItem,kind:'experience'|'project'){
 w.ensure(60);
 w.row(item.title,T.item,f.semibold,kind==='project'&&item.meta?`실무 · ${item.meta}`:item.meta,{underline:kind==='project'&&Boolean(item.url)});
 if(item.role)w.text(item.role,T.body,f.semibold,{after:1});
 if(item.summary)w.text(item.summary,T.body,f.regular,{color:SECONDARY});
 if(item.company)w.text(item.company,T.meta,f.regular,{color:MUTED});
 if(item.bullets.length){w.gap(3);w.bullets(item.bullets);}
 if(item.stack?.length){w.gap(2);w.text(item.stack.join('  ·  '),T.meta,f.regular,{color:MUTED});}
}
function compact(w:Writer,f:Fonts,item:ResumeItem){
 const titleWidth=w.measure(item.title,f.semibold,T.body.size)+10;
 w.ensure(T.body.size*T.body.lh*2);
 const top=w.y;w.text(item.title,T.body,f.semibold);const afterTitle=w.y;w.y=top;
 const tail=[item.meta,item.summary].filter(Boolean).join('  ·  ');
 if(tail)w.text(tail,T.body,f.regular,{color:SECONDARY,x:MARGIN.x+titleWidth,width:w.width-titleWidth});
 w.y=Math.min(w.y,afterTitle);
}
function table(w:Writer,f:Fonts,item:ResumeItem){
 const labelCol=84;
 w.ensure(T.body.size*T.body.lh*2);
 const top=w.y;
 if(item.label)w.text(item.label,T.meta,f.regular,{color:MUTED,width:labelCol-8});
 w.y=top;
 const right=item.meta?w.measure(item.meta,f.regular,T.meta.size):0;
 // Credentials: title in the emphasis weight with the issuer trailing in meta, both on one baseline. Skills: the value list in body weight.
 if(item.summary){const tw=w.measure(item.title,f.semibold,T.body.size);const y=w.y;w.text(item.title,T.body,f.semibold,{x:MARGIN.x+labelCol,width:w.width-labelCol-right-10});const after=w.y;w.page.drawText(sanitize(item.summary,f.regular),{x:MARGIN.x+labelCol+tw+7,y:y-T.body.size*.85,size:T.meta.size,font:f.regular,color:MUTED});w.y=after;}
 else w.text(item.title,T.body,f.regular,{x:MARGIN.x+labelCol,width:w.width-labelCol-right-10});
 if(item.meta)w.page.drawText(sanitize(item.meta,f.regular),{x:w.right-right,y:top-T.body.size*.85,size:T.meta.size,font:f.regular,color:MUTED});
}
export async function renderResume(doc:ResumeDoc):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();
 pdf.setTitle(`${doc.name} 이력서`);pdf.setAuthor(doc.name);pdf.setLanguage('ko-KR');pdf.setCreationDate(new Date());
 const f=await loadFonts(pdf);const w=new Writer(pdf,f,`${doc.name} · ${doc.role}`);
 // Hero: name, headline with years, summary, contacts as underlined links.
 w.text(doc.name,T.name,f.bold,{after:4});
 w.text(doc.years?`${doc.role} · ${doc.years}년차`:doc.role,T.section,f.semibold,{after:5});
 w.text(doc.intro,T.body,f.regular,{color:SECONDARY,after:5});
 if(doc.contacts.length){let x=MARGIN.x;const y=w.y;for(const c of doc.contacts){const width=w.measure(c.label,f.regular,T.meta.size);if(x+width>w.right){x=MARGIN.x;w.y-=T.meta.size*T.meta.lh;}const baseline=w.y-T.meta.size*.85;w.page.drawText(sanitize(c.label,f.regular),{x,y:baseline,size:T.meta.size,font:f.regular,color:INK});if(c.url)w.page.drawLine({start:{x,y:baseline-1.4},end:{x:x+width,y:baseline-1.4},thickness:.5,color:INK});x+=width+12;}w.y=Math.min(w.y,y)-T.meta.size*T.meta.lh;}
 w.rule(8,0);
 for(const section of doc.sections){
  w.gap(SECTION_GAP);w.ensure(70);
  w.text(section.title,T.section,f.semibold,{after:section.layout==='block'?6:8});
  section.items.forEach((item,i)=>{
   if(section.layout==='block'){if(i>0){if(section.title==='주요 프로젝트')w.rule(ITEM_GAP,ITEM_GAP);else w.gap(ITEM_GAP);}block(w,f,item,section.title==='경력'?'experience':'project');}
   else if(section.layout==='compact'){if(i>0)w.gap(4);compact(w,f,item);}
   else{if(i>0)w.gap(4);table(w,f,item);}
  });
 }
 w.gap(SECTION_GAP);w.rule(0,6);
 w.text(`이 이력서는 ${doc.generatedAt} 기준으로 사이트 데이터에서 생성되었습니다.`,T.meta,f.regular,{color:MUTED});
 w.finish();
 return pdf.save();
}
