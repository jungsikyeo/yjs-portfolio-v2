import {PDFDocument,PDFFont,PDFPage,rgb,type RGB} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {type ResumeDoc,wrapText} from './resume';
// Runs in the browser. Cloudflare's free Worker tier has a tight CPU budget, and font parsing plus
// subsetting is the expensive part, so the PDF is generated client-side from the same JSON the page
// already holds. The fonts are Pretendard trimmed to KS X 1001 Hangul plus Latin and served as static
// assets; they are embedded whole because fontkit's TrueType subsetter drops glyphs from this face, and
// stripped of OpenType layout tables because pdf-lib's advance widths ignore them (stray gaps after ':' and '-').
const A4={w:595.28,h:841.89},MARGIN={x:48,top:52,bottom:48};
const INK=rgb(.13,.15,.17),MUTED=rgb(.42,.46,.5),ACCENT=rgb(.16,.47,.42),RULE=rgb(.82,.84,.86);
type Fonts={regular:PDFFont;bold:PDFFont};
async function loadFonts(pdf:PDFDocument):Promise<Fonts>{
 pdf.registerFontkit(fontkit);
 const [r,b]=await Promise.all(['/fonts/Pretendard-Regular-subset.ttf','/fonts/Pretendard-Bold-subset.ttf'].map(async u=>{const res=await fetch(u);if(!res.ok)throw new Error(`font ${u} ${res.status}`);return res.arrayBuffer();}));
 return {regular:await pdf.embedFont(r,{subset:false}),bold:await pdf.embedFont(b,{subset:false})};
}
// Characters outside the embedded subset would render as empty boxes; swap them for a space instead.
function sanitize(text:string,font:PDFFont){const set=font.getCharacterSet();return [...text].map(ch=>set.includes(ch.codePointAt(0)!)?ch:' ').join('');}
class Writer{
 page!:PDFPage;y=0;pageNo=0;
 constructor(private pdf:PDFDocument,private fonts:Fonts,private title:string){this.newPage();}
 get width(){return A4.w-MARGIN.x*2;}
 newPage(){if(this.pageNo>0)this.footer();this.page=this.pdf.addPage([A4.w,A4.h]);this.pageNo++;this.y=A4.h-MARGIN.top;}
 footer(){const f=this.fonts.regular,s=8,label=sanitize(`${this.title}  ·  ${this.pageNo}`,f);this.page.drawText(label,{x:A4.w-MARGIN.x-f.widthOfTextAtSize(label,s),y:MARGIN.bottom-18,size:s,font:f,color:MUTED});}
 ensure(height:number){if(this.y-height<MARGIN.bottom)this.newPage();}
 text(text:string,{size,font,color=INK,x=MARGIN.x,width=this.width,lineHeight=1.45,after=0}:{size:number;font:PDFFont;color?:RGB;x?:number;width?:number;lineHeight?:number;after?:number}){
  const lines=wrapText(sanitize(text,font),width,s=>font.widthOfTextAtSize(s,size));const step=size*lineHeight;
  for(const line of lines){this.ensure(step);this.page.drawText(line,{x,y:this.y-size,size,font,color});this.y-=step;}
  this.y-=after;return lines.length;
 }
 rule(after=10){this.ensure(after+2);this.page.drawLine({start:{x:MARGIN.x,y:this.y},end:{x:A4.w-MARGIN.x,y:this.y},thickness:.6,color:RULE});this.y-=after;}
 gap(h:number){this.y-=h;}
 finish(){this.footer();}
}
export async function renderResume(doc:ResumeDoc):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();
 pdf.setTitle(`${doc.name} 이력서`);pdf.setAuthor(doc.name);pdf.setLanguage('ko-KR');pdf.setCreationDate(new Date());
 const fonts=await loadFonts(pdf);const w=new Writer(pdf,fonts,`${doc.name} · ${doc.role}`);
 w.text(doc.name,{size:21,font:fonts.bold,after:2});
 w.text(doc.role,{size:10.5,font:fonts.regular,color:ACCENT,after:6});
 w.text(doc.intro,{size:9.2,font:fonts.regular,color:MUTED,lineHeight:1.5,after:6});
 if(doc.contacts.length)w.text(doc.contacts.join('   ·   '),{size:8.6,font:fonts.regular,color:MUTED,after:4});
 w.rule(14);
 for(const section of doc.sections){
  w.ensure(48);
  w.text(section.title,{size:11.5,font:fonts.bold,color:ACCENT,after:3});w.rule(8);
  for(const item of section.items){
   w.ensure(section.compact?22:40);
   if(section.compact){
    // One line per item: title in bold, then meta and summary in the muted weight on the same visual row.
    const titleWidth=fonts.bold.widthOfTextAtSize(sanitize(item.title,fonts.bold),9.4)+8;
    const y=w.y;w.text(item.title,{size:9.4,font:fonts.bold});const rowLines=w.y;w.y=y;
    const tail=[item.meta,item.summary].filter(Boolean).join('  ·  ');
    if(tail)w.text(tail,{size:9,font:fonts.regular,color:MUTED,x:MARGIN.x+titleWidth,width:w.width-titleWidth});
    w.y=Math.min(w.y,rowLines);w.gap(3);
    continue;
   }
   const metaWidth=item.meta?fonts.regular.widthOfTextAtSize(sanitize(item.meta,fonts.regular),8.6):0;
   const y=w.y;w.text(item.title,{size:10.6,font:fonts.bold,width:w.width-metaWidth-10});
   if(item.meta){w.page.drawText(sanitize(item.meta,fonts.regular),{x:A4.w-MARGIN.x-metaWidth,y:y-9.4,size:8.6,font:fonts.regular,color:MUTED});}
   if(item.summary)w.text(item.summary,{size:9.2,font:fonts.regular,color:MUTED,lineHeight:1.5});
   for(const bullet of item.bullets){const bx=MARGIN.x+10;w.ensure(14);w.page.drawText('·',{x:MARGIN.x+2,y:w.y-9.2,size:9.2,font:fonts.bold,color:ACCENT});w.text(bullet,{size:9.2,font:fonts.regular,x:bx,width:w.width-10,lineHeight:1.5});}
   w.gap(7);
  }
  w.gap(6);
 }
 w.text(`이 이력서는 ${doc.generatedAt} 기준으로 사이트 데이터에서 생성되었습니다.`,{size:7.6,font:fonts.regular,color:MUTED});
 w.finish();
 return pdf.save();
}
