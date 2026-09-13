'use client';
import {useState,useMemo,useEffect,useRef} from 'react';
import {Activity,ArrowUpRight,Network,Briefcase,Layers,Code2,Search,Plus,Minus,Maximize,RotateCcw,List,ChevronRight,ChevronLeft,ArrowRight,Database,Mail,Monitor,Server,Wrench,AppWindow,GraduationCap,Award,type LucideIcon} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {SidebarProvider,Sidebar,SidebarContent,SidebarHeader,SidebarFooter,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarTrigger} from '@/components/ui/sidebar';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import type {Screenshot} from '@/lib/portfolio';
import {transitionView,scrollToTop} from '@/lib/motion';
import {ThemeControls} from './theme-controls';
import {type Portfolio,type Entry,type NarrativeBlock,edges,narrativeSections} from '@/lib/portfolio';
const kinds={person:'프로필',experience:'경력',project:'프로젝트',skill:'기술'};

// Map node boxes: full nodes hold a title and a caption, compact nodes a single line.
const NODE_HEIGHT=78,COMPACT_HEIGHT=50,COMPACT_PITCH=50,COMPACT_WIDTH=270;
const anchor=(p:{compact?:boolean})=>p.compact?25:34;
// A project may belong to several companies; the first listed one decides where it is grouped.
const parentsOf=(e:Entry)=>e.parents??(e.parent?[e.parent]:[]);

export default function Observatory({initial}:{initial:Portfolio}){
const [sourceData,setData]=useState(initial),[section,setSection]=useState('Overview'),[query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null),[view,setView]=useState('map'),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[detail,setDetail]=useState(false),[scope,setScope]=useState('all'); const drag=useRef<{x:number;y:number}|null>(null); const graphRef=useRef<HTMLDivElement>(null); const [motionPaused,setMotionPaused]=useState(false);
const data=useMemo(()=>{
 if(sourceData.demo)return sourceData;
 // An optional `featured` checkbox on the Experience DB picks the companies shown here; without it every company is shown.
 const experiences=sourceData.entries.filter(e=>e.kind==='experience');
 const companies=experiences.some(e=>e.featured!==undefined)?experiences.filter(e=>e.featured):experiences;
 const companyIds=new Set(companies.map(e=>e.id));
 const allCompanyIds=new Set(sourceData.entries.filter(e=>e.kind==='experience').map(e=>e.id));
 const projects=sourceData.entries.filter(e=>{if(e.kind!=='project')return false;const ps=parentsOf(e);return !ps.some(id=>allCompanyIds.has(id))||ps.some(id=>companyIds.has(id))});
 const retained=new Set([...companies,...projects].map(e=>e.id));
 const skills=new Set([...companies,...projects].flatMap(e=>e.tags));
 return {...sourceData,entries:sourceData.entries.filter(e=>e.kind==='person'||retained.has(e.id)||(e.kind==='skill'&&skills.has(e.id)))};
},[sourceData]);
const active=data.entries.find(e=>e.id===selected);const connections=useMemo(()=>edges(data.entries),[data.entries]);
const visible=useMemo(()=>data.entries.filter(e=>`${e.title} ${e.subtitle} ${e.tags.join(' ')} ${e.body.join(' ')}`.toLowerCase().includes(query.toLowerCase())),[data,query,section]);
const related=new Set([selected,...connections.filter(e=>e.from===selected||e.to===selected).flatMap(e=>[e.from,e.to])]);
const focusProject=data.entries.find(e=>e.id===scope&&e.kind==='project')??data.entries.find(e=>e.featured)??data.entries.find(e=>e.kind==='project');
const graphEntries=useMemo(()=>{if(!focusProject)return data.entries.filter(e=>e.kind!=='skill');if(scope==='all')return data.entries.filter(e=>e.kind!=='skill');const ids=new Set([focusProject.id,...parentsOf(focusProject),...focusProject.tags,...data.entries.filter(e=>e.kind==='person').map(e=>e.id)]);return data.entries.filter(e=>ids.has(e.id))},[data,scope,focusProject,query,section]);
const graphEdges=connections.filter(e=>graphEntries.some(n=>n.id===e.from)&&graphEntries.some(n=>n.id===e.to));
const overviewMap=scope==='all';
const layout=useMemo(()=>{
 const positions:Record<string,{x:number;y:number;compact?:boolean}>={};
 if(overviewMap){
  // Compact project rows keep the whole overview inside the standard map box;
  // each company sits beside the centre of its own project group.
  const companies=graphEntries.filter(e=>e.kind==='experience');
  const projects=graphEntries.filter(e=>e.kind==='project');
  const buckets=[...companies.map(company=>({company,projects:projects.filter(e=>parentsOf(e).find(id=>companies.some(c=>c.id===id))===company.id)})),{company:null,projects:projects.filter(e=>!parentsOf(e).some(id=>companies.some(c=>c.id===id)))}];
  let projectY=60,companyBottom=60;
  for(const bucket of buckets){
   if(!bucket.company&&!bucket.projects.length)continue;
   const groupHeight=bucket.projects.length*COMPACT_PITCH;
   bucket.projects.forEach((e,i)=>positions[e.id]={x:650,y:projectY+i*COMPACT_PITCH,compact:true});
   if(bucket.company){const y=Math.max(bucket.projects.length?projectY+(groupHeight-NODE_HEIGHT)/2:companyBottom,companyBottom);positions[bucket.company.id]={x:340,y};companyBottom=y+NODE_HEIGHT;}
   projectY+=groupHeight+(groupHeight?16:0);
  }
  const height=Math.max(420,Math.max(projectY,companyBottom)+40);
  graphEntries.filter(e=>e.kind==='person').forEach(e=>positions[e.id]={x:55,y:height/2-35});
  return {positions,height};
 }
 const height=Math.max(260,...['person','experience','project','skill'].map(k=>graphEntries.filter(e=>e.kind===k).length*78+80));
 (['person','experience','project','skill'] as const).forEach((k,col)=>{const group=graphEntries.filter(e=>e.kind===k);group.forEach((e,i)=>positions[e.id]={x:55+col*233,y:height/2-34+(i-(group.length-1)/2)*78})});
 return {positions,height};
},[graphEntries,overviewMap]);
const {positions,height:graphHeight}=layout;
function choose(id:string){if(!visible.some(e=>e.id===id)){setSection('Overview');setQuery('')}const item=data.entries.find(e=>e.id===id);if(item?.kind==='project'){setScope(id);setZoom(1);setPan({x:0,y:0})}else if(!graphEntries.some(e=>e.id===id))setScope('all');setSelected(id)}function reset(){setZoom(1);setPan({x:0,y:0});setSelected(null);setQuery('');setScope('all');setSection('Overview')}
useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')fetch('/api/portfolio').then(r=>r.ok?r.json():Promise.reject()).then(value=>setData(old=>{const next=value as Portfolio;return old.syncedAt===next.syncedAt&&old.status===next.status&&old.name===next.name?old:next})).catch(()=>setData(v=>v.demo?v:{...v,status:'stale',message:'콘텐츠 서버에 연결하지 못했습니다.'}))};const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh)}},[]);
useEffect(()=>{let onScreen=true;const update=()=>setMotionPaused(!onScreen||document.visibilityState!=='visible');const observer=new IntersectionObserver(([e])=>{onScreen=e.isIntersecting;update()});if(graphRef.current)observer.observe(graphRef.current);document.addEventListener('visibilitychange',update);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update)}},[view]);
useEffect(()=>{if(selected&&!visible.some(e=>e.id===selected))setSelected(null)},[visible,selected]);
return <SidebarProvider><a href="#main" className="skip">본문으로 이동</a><Sidebar className="side"><SidebarHeader><a className="brand" href="/"><span className="brand-icon"><Activity size={22}/></span> YJS<span className="brand-dot">.</span></a><div className="workspace"><span className="avatar">{data.demo?'C':data.name.slice(0,1)}</span><div>{data.demo?'Career workspace':data.name}<small>Personal portfolio</small></div></div></SidebarHeader><SidebarContent><p className="nav-label">WORKSPACE</p><SidebarMenu>{[['Overview',Network],['Experience',Briefcase],['Projects',Layers],['Skills',Code2]].map(([title,Icon])=><SidebarMenuItem key={String(title)}><SidebarMenuButton isActive={section===title} onClick={()=>{if(section!==title){transitionView(()=>{setSection(String(title));setQuery('');setSelected(null)});scrollToTop()}}}><Icon size={17}/><span>{String(title)}</span>{section===title&&<span className="nav-dot"/>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu><div className="side-note"><span className="tiny-label">EXPLORE THE CONNECTIONS</span><p>하나의 경력보다,<br/>연결된 경험의 힘.</p><div className="note-rule"/><small>노드를 선택해 경험의 맥락을<br/>살펴보세요.</small></div></SidebarContent><SidebarFooter><div className="side-bottom"><Database size={15}/><span>Powered by Notion</span><span className="status-dot amber"/></div></SidebarFooter></Sidebar><div className="shell"><header className="topbar"><div><SidebarTrigger/><span>Workspace</span><ChevronRight size={13}/><strong>{section}</strong></div><ThemeControls/></header><main id="main" key={section} className="screen-enter"><div className="page-heading"><div><div className="eyebrow"><span/> CAREER OBSERVABILITY</div><h1>{section==='Overview'?'경험의 연결, 한눈에.':section}</h1><p>프로젝트를 통해 기술을, 연결을 통해 커리어를 이해합니다.</p></div><span className={`env-badge ${data.status==='ready'?'healthy':''}`}><span className={`status-dot ${data.status==='ready'?'':'amber'}`}/>{data.demo?'DEMO WORKSPACE':data.status==='error'?'CONNECTION ERROR':data.status==='stale'?'SYNC DELAYED':'NOTION CONTENT'}</span></div>{(data.demo||data.status!=='ready')&&<div className={`notice ${data.status==='ready'?'healthy':''}`} role="status"><span>ⓘ</span><p>{data.demo?'현재는 탐색용 데모입니다. 실제 이력은 노션 연결 후 표시됩니다.':data.status==='error'?(data.message??'이력을 불러오지 못했습니다. 연결 설정을 확인해 주세요.'):data.status==='stale'?'노션 갱신 지연 · 마지막 정상 콘텐츠를 표시합니다.':'노션에서 가져온 이력입니다.'}</p></div>}
{section==='Overview'&&<section className="intro"><div className="profile-intro"><ProfilePhoto name={data.name} demo={data.demo}/><div className="profile-copy"><span className="tiny-label profile-role">{data.role}</span><h2>{data.name}</h2><p>{data.intro}</p><div className="contact-links">{data.email&&<a href={`mailto:${data.email}`}><Mail size={13}/>연락하기 <ArrowUpRight size={12}/></a>}{data.links?.map(link=><a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} <ArrowUpRight size={12}/></a>)}</div></div></div><div className="metrics">{(['experience','project','skill'] as const).map((kind,i)=><div key={kind}><span className="metric-label">{kind==='experience'&&!data.demo?'주요 경력':kinds[kind]} <span className="metric-code">0{i+1}</span></span><strong>{String(data.entries.filter(e=>e.kind===kind).length).padStart(2,'0')}<small>{kind==='skill'?'개 기술':kind==='experience'&&!data.demo?'곳':'개'}</small></strong><span>{data.demo?'데모 데이터 기준':kind==='skill'?'주요 경력·프로젝트 기술':kind==='experience'?'최근 주요 경력 기준':'표시된 프로젝트 기준'}</span></div>)}</div></section>}
{!data.demo&&<a className="career-archive" href="https://portfolio-yjs.netlify.app/" target="_blank" rel="noreferrer"><div><strong>이전 경력과 프로젝트</strong><span>SK플래닛·알비클라우드 이전의 경험은 이전 포트폴리오에서 확인하실 수 있습니다.</span></div><ArrowUpRight size={18}/></a>}
{section==='Overview'&&<section className="explorer"><div className="panel-heading"><div><Network size={18}/><h2>Career topology</h2><span className="subtle">경력 연결 지도</span></div><span className="mono subdued">{graphEntries.length} NODES · {graphEdges.length} RELATIONS</span></div><Tabs value={view} onValueChange={value=>transitionView(()=>setView(value))}><div className="toolbar"><label className="search"><Search size={15}/><input aria-label="경력, 프로젝트, 기술 검색" placeholder="프로젝트, 기술 검색..." value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')} aria-label="검색 지우기">×</button>}</label><button className="overview-reset" onClick={reset}>전체 경력</button><TabsList><TabsTrigger value="map"><Network size={14}/><span>지도</span></TabsTrigger><TabsTrigger value="list"><List size={14}/><span>목록</span></TabsTrigger></TabsList></div><TabsContent value="map"><div className="graph-layout"><div className="map-and-schedule"><div ref={graphRef} className={`graph selection-lift ${graphHeight>800?'large-graph':''} ${motionPaused?'motion-paused':''} ${overviewMap?'map-overview':'map-focus'}`}><div className={`column-labels ${overviewMap?'overview-columns':''}`}><span>PROFILE</span><span>EXPERIENCE</span><span>PROJECTS</span>{!overviewMap&&<span>TECHNOLOGIES</span>}</div><div className="graph-viewport screen-enter" key={scope}><svg style={{height:'auto',aspectRatio:`980 / ${graphHeight}`,minWidth:overviewMap?900:735}} viewBox={`0 0 980 ${graphHeight}`} aria-label="커리어 관계 지도. 키보드 및 모바일 사용자는 목록 탭으로 동일하게 탐색할 수 있습니다." onPointerDown={e=>{if(e.target===e.currentTarget){drag.current={x:e.clientX-pan.x,y:e.clientY-pan.y};e.currentTarget.setPointerCapture(e.pointerId)}}} onPointerMove={e=>{if(drag.current)setPan({x:e.clientX-drag.current.x,y:e.clientY-drag.current.y})}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}><g transform={`translate(${pan.x} ${pan.y}) translate(490 ${graphHeight/2}) scale(${zoom}) translate(-490 ${-graphHeight/2})`}>{graphEdges.map((e,i)=>{const a=positions[e.from],b=positions[e.to];if(!a||!b)return null;const shown=visible.some(n=>n.id===e.from)&&visible.some(n=>n.id===e.to);return <path key={i} className={selected&&(e.from===selected||e.to===selected)?'edge selected-edge':'edge'} opacity={!shown?.1:selected&&!related.has(e.from)?.45:1} d={`M ${a.x+168} ${a.y+anchor(a)} C ${a.x+200} ${a.y+anchor(a)},${b.x-45} ${b.y+anchor(b)},${b.x+5} ${b.y+anchor(b)}`}/>})}{graphEntries.map(e=>{const p=positions[e.id],shown=visible.some(n=>n.id===e.id);return <g key={e.id} opacity={!shown?.12:selected&&!related.has(e.id)?.72:1}><foreignObject x={p.x} y={p.y} width={p.compact?COMPACT_WIDTH:175} height={p.compact?COMPACT_HEIGHT:NODE_HEIGHT}><button disabled={!shown} tabIndex={shown?0:-1} aria-pressed={selected===e.id} className={`node ${e.kind} ${p.compact?'compact':''} ${selected===e.id?'chosen':''}`} onClick={()=>choose(e.id)}><span className="node-symbol">{e.kind==='person'?'◉':e.kind==='experience'?'▦':e.kind==='project'?'◇':'⌘'}</span><span><strong>{e.title}</strong><small>{p.compact?`기술 ${e.tags.length}개`:kinds[e.kind]}</small></span><span className="node-pin"/></button></foreignObject></g>})}</g></svg></div>{!visible.length&&<div className="empty">검색 결과가 없습니다.<button onClick={reset}>필터 초기화</button></div>}<div className="graph-bottom"><span>노드를 선택해 연결된 경험을 탐색하세요</span><div className="zoom-controls"><button aria-label="축소" onClick={()=>setZoom(v=>Math.max(.5,v-.15))}><Minus size={15}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="확대" onClick={()=>setZoom(v=>Math.min(2,v+.15))}><Plus size={15}/></button><button aria-label="전체 보기" onClick={()=>{setZoom(1);setPan({x:0,y:0})}}><Maximize size={14}/></button><button aria-label="초기화" onClick={reset}><RotateCcw size={14}/></button></div></div></div><ProjectSchedule entries={data.entries} selected={selected} onSelect={choose}/></div><aside className="inspector"><div key={selected??'empty'} className="screen-enter"><span className="tiny-label">INSPECTOR</span>{active?<><span className={`type-tag ${active.kind}`}>{kinds[active.kind]}</span><h3>{active.title}</h3><p>{active.subtitle}</p><div className="inspector-rule"/><p>{active.kind==='experience'?active.body[0]:active.body.slice(0,2).join(' · ')}</p><div className="tags">{active.tags.map(t=><button key={t} onClick={()=>choose(t)}>{data.entries.find(e=>e.id===t)?.title??t}</button>)}</div><button className="detail-link" onClick={()=>setDetail(true)}>상세 내용 보기 <ArrowRight size={15}/></button></>:<><div className="inspect-icon"><Network size={27}/></div><h3>경험을 더 가까이</h3><p>지도에서 노드를 선택하면<br/>역할, 기술, 성과와<br/>연결된 경험을 볼 수 있습니다.</p><div className="inspector-rule"/><span className="tiny-label">HOW TO EXPLORE</span><ol><li>관심 있는 프로젝트 선택</li><li>연결된 기술과 경력 확인</li><li>상세 내용에서 맥락 탐색</li></ol></>}</div></aside></div></TabsContent><TabsContent value="list"><div className="quadrant-list">{[
 {title:'프로필 · 경력',items:visible.filter(e=>e.kind==='person'||e.kind==='experience')},
 {title:'프로젝트',items:visible.filter(e=>e.kind==='project')},
 {title:'기술 · 01',items:visible.filter(e=>e.kind==='skill').slice(0,Math.ceil(visible.filter(e=>e.kind==='skill').length/2))},
 {title:'기술 · 02',items:visible.filter(e=>e.kind==='skill').slice(Math.ceil(visible.filter(e=>e.kind==='skill').length/2))}
 ].map(group=><section key={group.title}><h3><span className="quadrant-heading"><i aria-hidden="true">{group.title==='프로필 · 경력'?<Briefcase size={17}/>:group.title==='프로젝트'?<Layers size={17}/>:<Code2 size={17}/>}</i>{group.title}</span><span>{group.items.length}</span></h3><div>{group.items.map(e=><button key={e.id} onClick={()=>{choose(e.id);setDetail(true)}}><span><strong>{e.title}</strong><small>{e.kind==='skill'?e.subtitle:e.role||e.subtitle}</small></span><ArrowUpRight size={15}/></button>)}{!group.items.length&&<p>검색 결과가 없습니다.</p>}</div></section>)}</div></TabsContent></Tabs><footer className="legend"><div>{Object.entries(kinds).map(([k,label])=><span key={k}><i className={k}/>{label}</span>)}</div><span>실선: 경력 소속 / 프로젝트 참여 / 기술 사용</span></footer></section>}
{section!=='Overview'&&<section className="projects"><div className="section-title"><div><h2>{section==='Experience'?'경력 타임라인':section==='Skills'?'기술과 프로젝트':'프로젝트 탐색'}</h2><span>경험을 만든 문제와 해결 과정</span></div><button onClick={()=>{transitionView(()=>{setSection('Overview');setView('map')});scrollToTop()}}>전체 보기 <ArrowRight size={14}/></button></div>{section==='Skills'?<SkillGroups entries={data.entries} onSelect={id=>{choose(id);setDetail(true)}}/>:<div className={`project-grid ${section==='Experience'?'timeline':''}`}>{data.entries.filter(e=>e.kind===(section==='Experience'?'experience':section==='Skills'?'skill':'project')).filter(e=>section!=='Overview'||data.demo||e.featured).map((e,i)=><button className="project-card" key={e.id} onClick={()=>{choose(e.id);setDetail(true)}}><div className="project-top"><span className="project-icon"><Layers size={18}/></span><span className="mono">{String(i+1).padStart(2,'0')} / {data.demo?'DEMO':kinds[e.kind]}</span><ArrowUpRight size={16}/></div><h3>{e.title}</h3><p>{e.subtitle}</p>{section==='Experience'&&<p className="experience-summary">{e.body[0]}</p>}{e.period&&<span className="project-period">{e.period}</span>}<div className="tags">{e.tags.map(t=><span key={t}>{data.entries.find(e=>e.id===t)?.title??t}</span>)}</div></button>)}</div>}</section>}{section==='Experience'&&data.credentials&&<section className="credentials" aria-labelledby="credentials-heading"><div className="section-title"><div><h2 id="credentials-heading">학력 · 자격</h2></div></div><div className="credential-grid">{data.credentials.map(e=>{const Icon=/학사|석사|박사|대학교|대학원/.test(e.title+' '+e.issuer)?GraduationCap:Award;return <article className="credential-card" key={e.title}><div className="credential-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.6}/></div><div className="credential-copy"><h3>{e.title}</h3><div className="credential-meta"><span>{e.issuer}</span>{e.date&&<time dateTime={e.date.slice(0,7)}>{e.date.slice(0,7).replace('-','. ')}</time>}</div></div></article>})}</div></section>}<footer className="page-footer"><span><Activity size={13}/> Built around experience, connected by purpose.</span><span>{data.syncedAt?`최근 성공 동기화 ${new Date(data.syncedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`:data.demo?'노션 미연결 · 동기화 기록 없음':'동기화 성공 기록 없음'}</span></footer></main></div><Sheet open={detail} onOpenChange={setDetail}><SheetContent className="detail-sheet"><SheetHeader><span className="tiny-label">{data.demo?'DEMO CONTENT':'CAREER DETAIL'}</span><SheetTitle>{active?.title||'항목을 선택하세요'}</SheetTitle><SheetDescription>{active?.subtitle}</SheetDescription></SheetHeader><div className="detail-body screen-enter" key={active?.id}>{active&&<DetailContent key={active.id} entry={active}/>}<h4>연결된 경험</h4>{data.entries.filter(e=>e.id!==selected&&related.has(e.id)).map(e=><button key={e.id} onClick={()=>choose(e.id)}>{e.title}<ArrowRight size={14}/></button>)}{(active?.links??(active?.url?[active.url]:[])).map((url,i)=><a className="detail-link" key={url} href={url} target="_blank" rel="noreferrer">관련 링크 {i+1} ↗</a>)}</div></SheetContent></Sheet></SidebarProvider>}

const skillGroupIcons:Record<string,LucideIcon>={'언어':Code2,'프론트엔드':Monitor,'백엔드':Server,'데이터':Database,'플랫폼':AppWindow,'도구':Wrench,'경력·프로젝트 사용 기술':Network};

function SkillGroups({entries,onSelect}:{entries:Entry[];onSelect:(id:string)=>void}){const groups=Array.from(new Set(entries.filter(e=>e.kind==='skill').map(e=>e.subtitle)));return <div className="skill-groups">{groups.map(group=>{const Icon=skillGroupIcons[group]??Layers;return <section key={group}><h3><span className="skill-group-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.7}/></span>{group}</h3><div>{entries.filter(e=>e.kind==='skill'&&e.subtitle===group).map(e=><button key={e.id} onClick={()=>onSelect(e.id)}>{e.title}<span>{entries.filter(p=>p.tags.includes(e.id)).length}개 연결</span></button>)}</div></section>})}</div>}

function ProfilePhoto({name,demo}:{name:string;demo:boolean}){
  const [failed,setFailed]=useState(false);
  if(demo)return null;
  return <div className="profile-photo-frame">{failed?<span className="profile-photo-fallback" aria-label={`${name} 프로필`}>{name.slice(0,1)}</span>:<img className="profile-photo" src="https://avatars.githubusercontent.com/u/52211215?v=4" width={112} height={112} alt={`${name}의 GitHub 프로필 사진`} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}<span className="photo-caption">GITHUB PROFILE</span></div>;
}

function DetailContent({entry}:{entry:Entry}) {
 const [tab,setTab]=useState('overview');
 const metadata=[['역할',entry.role],['기간',entry.period]].filter(([,v])=>v);
 const {overview,process}=narrativeSections(entry);
 const renderBlocks=(items:NarrativeBlock[])=><div className="detail-narrative">{items.map((b,i)=><article className="detail-paragraph" key={i}><div className="detail-paragraph-heading"><span>{String(i+1).padStart(2,'0')}</span><h4>{b.title}</h4></div><div>{b.lines.length>1?<ul>{b.lines.map((line,j)=><li key={j}>{line}</li>)}</ul>:<p>{b.lines[0]}</p>}</div></article>)}</div>;
 return <>
 {metadata.length>0&&<dl className="detail-facts">{metadata.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
 {entry.kind!=='experience'&&<div className="project-evidence"><span><strong>{entry.tags.length}</strong>연결 기술</span>{entry.links?.length? <span><strong>{entry.links.length}</strong>관련 자료</span>:null}</div>}
 <Tabs value={tab} onValueChange={value=>transitionView(()=>setTab(value))} className="case-tabs"><TabsList aria-label="프로젝트 상세 구성"><TabsTrigger value="overview">개요</TabsTrigger>{process.length>0&&<TabsTrigger value="process">구현 과정</TabsTrigger>}</TabsList>
 <TabsContent value="overview">{entry.screenshots?.length?<ScreenshotGallery title={entry.title} shots={entry.screenshots}/>:null}{overview.length?renderBlocks(overview):<p>{entry.subtitle}</p>}</TabsContent>
 {process.length>0&&<TabsContent value="process"><p className="process-caption">주요 작업 · 항목을 펼쳐 내용을 확인하세요</p><div className="process-timeline">{process.flatMap(b=>b.lines).map((line,i)=><details key={i} open={i===0}><summary><span>{String(i+1).padStart(2,'0')}</span><strong>{line.length>26?line.slice(0,26)+'…':line}</strong></summary>{line.length>26&&<p>{line}</p>}</details>)}</div></TabsContent>}
 
 </Tabs>
 </>;
}

function ProjectSchedule({entries,selected,onSelect}:{entries:Entry[];selected:string|null;onSelect:(id:string)=>void}) {
 const now=new Date();const current=now.getFullYear()*12+now.getMonth();
 const rows=entries.filter(e=>e.kind==='project').flatMap(e=>{const dates=[...(e.period??'').matchAll(/(\d{4})[.\/-](\d{2})/g)];if(!dates.length)return [];const start=Number(dates[0][1])*12+Number(dates[0][2])-1;const ongoing=/현재|진행|운영중/.test(e.period??'');const end=ongoing?current:dates[1]?Number(dates[1][1])*12+Number(dates[1][2])-1:start;return [{entry:e,start,end:Math.max(start,end),ongoing}];}).sort((a,b)=>a.start-b.start);
 if(!rows.length)return null;
 const start=Math.min(...rows.map(r=>r.start));const end=Math.max(...rows.map(r=>r.end))+1;const span=end-start;
 const label=(n:number)=>`${Math.floor(n/12)}.${String(n%12+1).padStart(2,'0')}`;
 return <section className="project-schedule"><header><h3>프로젝트 기간</h3><span>노션 등록 기간 · 월 단위</span></header><div className="schedule-scroll"><div className="schedule-axis"><span>프로젝트</span><div>{[0,.25,.5,.75,1].map(r=><span key={r}>{label(Math.min(end-1,Math.floor(start+span*r)))}</span>)}</div></div>{rows.map(({entry,start:from,end:to,ongoing})=><button className="schedule-row" key={entry.id} aria-pressed={selected===entry.id} onClick={()=>onSelect(entry.id)}><span><strong>{entry.title}</strong><small>{entry.period}</small></span><div className="schedule-track"><span className={`schedule-bar ${ongoing?'ongoing':''}`} style={{left:`${(from-start)/span*100}%`,width:`${(to-from+1)/span*100}%`}}/></div></button>)}</div></section>;
}

// A compact slideshow for project screenshots; clicking a slide opens it full size in a nested dialog.
function ScreenshotGallery({title,shots}:{title:string;shots:Screenshot[]}) {
 const [index,setIndex]=useState(0);
 const [open,setOpen]=useState(false);
 const [direction,setDirection]=useState<1|-1>(1);
 const count=shots.length;
 // Direction follows the button pressed, so wrapping from the last slide to the first still slides forward.
 const go=(next:number,dir:1|-1=next>index?1:-1)=>{setDirection(dir);setIndex((next+count)%count)};
 const label=(i:number)=>`${title} 실제 화면 ${i+1} / ${count}`;
 return <div className="detail-gallery" role="group" aria-label={`${title} 스크린샷`} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();go(index-1,-1)}else if(e.key==='ArrowRight'){e.preventDefault();go(index+1,1)}}}>
  <div className="detail-shot">
   <div className="gallery-track" style={{transform:`translateX(-${index*100}%)`}}>
    {shots.map((shot,i)=><button type="button" className="gallery-slide" key={shot.src} aria-hidden={i!==index} tabIndex={i===index?0:-1} aria-label={`${label(i)} 크게 보기`} onClick={()=>setOpen(true)}>{shot.kind==='video'?<video src={shot.src} muted autoPlay loop playsInline preload="metadata" aria-label={label(i)}/>:<img src={shot.src} alt={label(i)} loading={i===0?'eager':'lazy'} decoding="async"/>}</button>)}
   </div>
  </div>
  {count>1&&<div className="gallery-nav"><button type="button" className="gallery-arrow" aria-label="이전 화면" onClick={()=>go(index-1,-1)}><ChevronLeft size={15}/></button><div role="tablist" aria-label="화면 선택" className="gallery-dots">{shots.map((shot,i)=><button type="button" key={shot.src} role="tab" aria-selected={i===index} aria-label={label(i)} onClick={()=>setIndex(i)}/>)}</div><button type="button" className="gallery-arrow" aria-label="다음 화면" onClick={()=>go(index+1,1)}><ChevronRight size={15}/></button></div>}
  <Dialog open={open} onOpenChange={setOpen}>
   <DialogContent className="gallery-lightbox" showCloseButton={false} onClick={()=>setOpen(false)}>
    <DialogTitle className="sr-only">{label(index)}</DialogTitle>
    {shots[index].kind==='video'?<video key={shots[index].src} className={direction>0?'enter-next':'enter-prev'} src={shots[index].src} controls autoPlay loop playsInline aria-label={label(index)} onClick={e=>e.stopPropagation()}/>:<img key={shots[index].src} className={direction>0?'enter-next':'enter-prev'} src={shots[index].src} alt={label(index)} decoding="async"/>}
    {count>1&&<><button type="button" className="gallery-arrow prev" aria-label="이전 화면" onClick={e=>{e.stopPropagation();go(index-1,-1)}}><ChevronLeft size={20}/></button><button type="button" className="gallery-arrow next" aria-label="다음 화면" onClick={e=>{e.stopPropagation();go(index+1,1)}}><ChevronRight size={20}/></button></>}
    <span className="gallery-caption mono">{index+1} / {count} · 클릭 또는 Esc로 닫기</span>
   </DialogContent>
  </Dialog>
 </div>;
}
