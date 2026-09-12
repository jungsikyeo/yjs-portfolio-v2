import {env} from 'cloudflare:workers';
const KEY=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Screenshots are immutable per key (a re-upload in Notion gets a new file id), so they cache for a year.
export async function GET(_request:Request,{params}:{params:Promise<{key:string}>}){
 const {key}=await params;
 const bucket=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;
 if(!KEY.test(key)||!bucket)return new Response(null,{status:404});
 const object=await bucket.get(key);
 if(!object)return new Response(null,{status:404});
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType??'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable','ETag':object.httpEtag,'X-Content-Type-Options':'nosniff'}});
}
