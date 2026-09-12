import {env} from 'cloudflare:workers';
import {getPortfolio} from '@/lib/notion';
const KEY=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const runtime=env as unknown as {BUCKET?:R2Bucket;NOTION_TOKEN?:string};
const IMMUTABLE={'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'};
// Screenshots are mirrored lazily on first request, in their own invocation, so the Notion sync
// never spends its subrequest budget on images. A key is immutable (a re-upload gets a new id).
export async function GET(_request:Request,{params}:{params:Promise<{key:string}>}){
 const {key}=await params;
 const bucket=runtime.BUCKET;
 if(!KEY.test(key)||!bucket)return new Response(null,{status:404});
 const cached=await bucket.get(key);
 if(cached)return new Response(cached.body,{headers:{...IMMUTABLE,'Content-Type':cached.httpMetadata?.contentType??'application/octet-stream','ETag':cached.httpEtag}});
 // Only keys that the published snapshot references are fetched, so this cannot read arbitrary Notion files.
 const portfolio=await getPortfolio();
 const owner=portfolio.entries.find(e=>e.screenshots?.some(s=>s.key===key));
 if(!owner||!runtime.NOTION_TOKEN)return new Response(null,{status:404});
 const page=await fetch(`https://api.notion.com/v1/pages/${owner.id}`,{headers:{Authorization:`Bearer ${runtime.NOTION_TOKEN}`,'Notion-Version':'2022-06-28'}});
 if(!page.ok)return new Response(null,{status:502});
 const properties=(await page.json() as {properties:Record<string,{type:string;files?:{type:string;file?:{url:string}}[]}>}).properties;
 const url=Object.values(properties).flatMap(p=>p.type==='files'?p.files??[]:[]).map(f=>f.file?.url).find(u=>u?.includes(`/${key}/`));
 if(!url)return new Response(null,{status:404});
 const source=await fetch(url);
 if(!source.ok||!source.body)return new Response(null,{status:502});
 const contentType=source.headers.get('content-type')??'application/octet-stream';
 const bytes=await source.arrayBuffer();
 await bucket.put(key,bytes,{httpMetadata:{contentType}});
 return new Response(bytes,{headers:{...IMMUTABLE,'Content-Type':contentType}});
}
