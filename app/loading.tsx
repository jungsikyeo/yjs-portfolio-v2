import {Skeleton} from '@/components/ui/skeleton';
export default function Loading(){return <main aria-busy="true"><p role="status">노션에서 경력을 불러오고 있습니다…</p><Skeleton className="h-20 my-8"/><Skeleton className="h-96"/></main>}
