export type Kind = 'person' | 'experience' | 'project' | 'skill';
export type Entry = {id:string; kind:Kind; title:string; subtitle:string; body:string[]; parent?:string; parents?:string[]; tags:string[]; url?:string; links?:string[]; period?:string; category?:string; role?:string; featured?:boolean};
export type Portfolio = {name:string; role:string; intro:string; entries:Entry[]; demo:boolean; syncedAt:string|null; status:'demo'|'ready'|'stale'|'error'; message?:string; email?:string; links?:{label:string;url:string}[]; credentials?:{title:string;issuer:string;date:string}[]};
export const sourceUrl='https://app.notion.com/p/3c404ce782f080658de5e1e63f28e24d';
export const demo:Portfolio={name:'커리어를 연결하고,\n경험을 관측합니다.',role:'CAREER OBSERVATORY',intro:'어떤 문제를 만났고, 어떻게 해결했는지. 경력과 프로젝트, 기술의 연결에서 전문성을 탐색하세요.',demo:true,syncedAt:null,status:'demo',entries:[
{id:'me',kind:'person',title:'프로필',subtitle:'이력서 연결 대기',body:['이 화면은 탐색 기능을 위한 데모입니다. 이름, 회사, 경력 및 성과를 실제 이력으로 제시하지 않습니다.'],tags:[]},
{id:'platform',kind:'experience',title:'플랫폼 개발',subtitle:'경력 그룹 · 데모',parent:'me',body:['프로젝트가 속한 경력 또는 도메인을 보여주는 예시입니다.'],tags:[]},
{id:'product',kind:'experience',title:'제품 개발',subtitle:'경력 그룹 · 데모',parent:'me',body:['실제 회사와 역할은 노션 연결 후 표시됩니다.'],tags:[]},
{id:'observability',kind:'project',title:'관측 플랫폼',subtitle:'시스템을 이해하는 도구',parent:'platform',body:['문제 · 여러 서비스의 상태와 관계를 한눈에 이해하기 어렵습니다.','접근 · 서비스의 의존 관계와 상세 탐색을 하나의 화면에 연결하는 예시입니다.','결과 · 데모 콘텐츠이므로 실제 성과 수치를 제공하지 않습니다.'],tags:['TypeScript','React']},
{id:'pipeline',kind:'project',title:'데이터 파이프라인',subtitle:'흐름을 안정적으로 연결',parent:'platform',body:['문제 · 외부 데이터의 변경과 일시적인 오류를 처리해야 합니다.','접근 · 정규화 계층과 마지막 정상 데이터 캐시를 분리하는 예시입니다.'],tags:['Python','PostgreSQL']},
{id:'design',kind:'project',title:'디자인 시스템',subtitle:'일관된 제품 경험',parent:'product',body:['문제 · 화면마다 다른 인터랙션을 일관되게 만들어야 합니다.','접근 · 접근 가능한 공통 컴포넌트를 구성하는 예시입니다.'],tags:['React','TypeScript']},
...['TypeScript','React','Python','PostgreSQL'].map(title=>({id:title,kind:'skill' as Kind,title,subtitle:'사용 기술 · 데모',body:['연결된 프로젝트에서 사용한 기술을 보여주는 예시입니다. 숙련도를 수치로 환산하지 않습니다.'],tags:[]}))]};
export function edges(entries:Entry[]){return entries.flatMap(e=>[...(e.parents??(e.parent?[e.parent]:[])).filter(p=>entries.some(n=>n.id===p)).map(p=>({from:p,to:e.id,label:e.kind==='experience'?'경력':'참여'})),...e.tags.filter(t=>entries.some(n=>n.id===t)).map(t=>({from:e.id,to:t,label:'사용 기술'}))]);}
