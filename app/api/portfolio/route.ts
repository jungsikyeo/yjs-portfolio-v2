import { getPortfolio } from '@/lib/notion';
export async function GET(){return Response.json(await getPortfolio(),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
