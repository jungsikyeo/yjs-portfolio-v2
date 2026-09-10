import Observatory from './observatory';
import { getPortfolio } from '@/lib/notion';
export async function generateMetadata(){const data=await getPortfolio();const title=data.demo?'Vantage · Career Observatory':`${data.name} · ${data.role}`;const description=data.intro.slice(0,160);return {title,description,openGraph:{title,description,locale:'ko_KR',type:'website'},twitter:{card:'summary',title,description}}}
export default async function Home(){return <Observatory initial={await getPortfolio()}/>}
