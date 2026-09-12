# Vantage · Career Observatory

경력 → 프로젝트 → 실제 사용 기술을 탐색하는 APM 콘셉트 포트폴리오입니다. React 19, TypeScript, Vinext/Vite, Cloudflare Workers 및 D1을 사용합니다.

## 현재 콘텐츠 상태

제공받은 루트 페이지는 **「포트폴리오 콘텐츠」**이며, 2026-09-11에 기존 Integration으로 실제 조회했습니다. Profile / Experience / Project / Skill / Credential의 다섯 하위 데이터베이스를 확인해 연결했습니다. 현재 실제 프로필, 경력 6개, 프로젝트 7개가 표시됩니다. 기술은 Skill DB 및 경력·프로젝트 stack의 고유 기술명 합집합으로 계산합니다 (조회 시 33개). `Vue3`, `Vue 3`, `Vue.js`처럼 서로 다른 원문 표기는 임의로 합치지 않습니다.

기존 `/Users/yjs/IdeaProjects/yjs-portfolio-v2/.env`의 Notion 연결을 재사용했습니다. 토큰은 이 프로젝트의 Git 제외 `.env`와 Sites 비밀 환경 변수에만 저장했습니다. 데모는 인증이 설정되지 않은 개발 환경에서만 표시합니다.

## 실행

```sh
npm ci
npm run dev
```

로컬 주소는 실행 로그에 표시됩니다 (기본 `http://localhost:5173`). Node 22.13 이상이 필요합니다.

```sh
npm test
npx tsc --noEmit
npm run build
```

## Notion 설정

`.env.example`을 참고해 `.env`를 설정하세요. 비밀 키는 서버 전용입니다.

| 변수 | 용도 |
|---|---|
| `NOTION_TOKEN` | 읽기 권한만 가진 Internal Integration의 토큰 |
| `NOTION_ROOT_ID` | 공개할 단일 루트 페이지 또는 데이터베이스 ID |
| `NOTION_PUBLISH_ENABLED` | 루트 콘텐츠의 사이트 노출을 허용하면 `true` |
| `DB` | Sites가 연결하는 영구 D1 바인딩 (환경 변수 문자열이 아님) |

1. Notion Developer portal에서 읽기 전용 Internal Integration을 생성하거나 기존 연결을 재사용합니다.
2. 해당 이력서 페이지의 `••• → Connections / 연결 추가`에서 Integration을 연결합니다. 웹 공개와 Integration의 API 접근 권한은 별개입니다. API 방식에는 페이지를 전체 웹에 공개할 필요가 없습니다.
3. `.env`에 토큰을 설정하고 노출 범위를 확인한 뒤 `NOTION_PUBLISH_ENABLED=true`로 설정합니다. 서버를 재시작합니다. `NEXT_PUBLIC_` 접두사나 브라우저 입력에 토큰을 넣지 마세요.
4. 호스팅에서는 Sites의 서버 환경 변수로 동일한 설정을 등록합니다. `.env`는 배포하지 않습니다.
5. D1 마이그레이션은 배포 시 자동 적용됩니다. 로컬 DB를 사용할 때는 빌드 후 다음을 한 번 실행합니다.

```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_huge_wolfsbane.sql
```

실제 문서 구조에 맞는 어댑터는 `lib/notion-workspace.ts`입니다. 기존 노션 편집 방식은 바꿀 필요가 없습니다.

| 데이터베이스 | 기존 속성 |
|---|---|
| Profile | name, headline, summary, email, github, linkedin, blog |
| Experience | company, role, period, summary, stack, order, domain, featured(선택) |
| Project | title, oneLiner, role, period, stack, experience(Relation, 여러 개 가능), featured, order, repoUrls, demoUrl, docsUrl, achievements |
| Skill | name, category, order |
| Credential | title, issuer, date |

`NOTION_DB_PROFILE`, `NOTION_DB_EXPERIENCE`, `NOTION_DB_PROJECT`, `NOTION_DB_SKILL`, `NOTION_DB_CREDENTIAL`은 서버에 설정된 명시적 데이터베이스 허용 목록입니다. 매번 해당 DB가 지정 루트의 직접 하위인지 검사합니다. 이 기존 포트폴리오 DB의 행은 기본 노출하며, 선택적으로 `Published` 체크박스를 추가하면 **false인 행을 제외**합니다. 이 다섯 DB 이외의 하위 페이지나 DB는 조회하지 않습니다.

Experience DB에 `featured` 체크박스를 추가하면 체크된 회사와 그 소속 프로젝트만 사이트에 표시됩니다. 체크되지 않은 회사는 「이전 경력과 프로젝트」 링크로만 안내합니다. 속성이 없으면 모든 회사를 표시합니다. 노션 본문/속성은 수정하지 않았습니다.

## 대체 어댑터의 최소 콘텐츠 규칙

아래는 위의 다섯 DB 환경 변수를 지정하지 않는 다른 문서용 fallback입니다. 현재 연결에는 적용되지 않습니다.

### 일반 페이지

페이지 제목을 기본 프로필 제목으로 사용합니다. 선택적으로 본문에 `이름:`, `직무:`를 쓸 수 있습니다. 기타 소개 문장은 원문을 유지합니다.

- `경력` 또는 `Experience` 제목 아래의 하위 제목은 회사/경력 항목입니다.
- `프로젝트` 또는 `Projects` 제목 아래의 하위 제목은 프로젝트 항목입니다.
- `기술` / `기술 스택` / `Skills` 아래 항목은 기술입니다.
- 프로젝트의 `회사: 정확한 경력 제목` 또는 `경력: 정확한 경력 제목`만 소속 관계로 연결합니다.
- `사용 기술: React, TypeScript`와 같이 쉼표로 나눈 명시적인 기술만 프로젝트에 연결합니다.
- `역할:`, `기간:`, `직무:`는 요약에, `링크:` / `URL:`은 안전한 외부 링크에 반영합니다.
- 본문의 문제, 해결 과정, 성과는 원문으로 보존하며 숫자나 숙련도를 추론하지 않습니다.

일반 중첩 블록은 재귀적으로 읽습니다. 다른 페이지, 하위 페이지/데이터베이스, 외부 동기화 블록은 범위를 넘어 읽지 않습니다. 루트 페이지에 노출하면 안 되는 정보가 있다면 공개용 루트를 별도로 지정하세요. 기존 문서 구조가 위 규칙과 다르면 최초 연결 시 어댑터를 조정해야 합니다.

### 데이터베이스

루트 조회가 데이터베이스로 확인되면 공식 `data_sources`를 조회합니다. **Published 체크박스가 true인 행만 노출**합니다. 제목 속성은 실제 title 타입을 사용합니다.

- `Type`: person / experience / project / skill (Select)
- `Role`: 역할 (Rich text)
- `Skills`: 실제 사용 기술 (Multi-select)
- `Parent`: 같은 공개 데이터 내 소속 항목 (Relation)
- `URL`: 관련 링크 (URL)
- `Published`: 명시적 공개 여부 (Checkbox)

행의 본문은 중첩 블록을 포함해 조회합니다. 숨긴 행으로 향하는 연결선은 표시하지 않습니다.

## 자동 반영 및 실패 처리

- 브라우저에서 보이는 동안 60초마다 `/api/portfolio`를 조회합니다. 서버는 D1의 마지막 성공 스냅샷을 기본 **5분** 동안 재사용합니다.
- 만료 후 첫 요청이 공식 Notion API를 재조회합니다. 열린 화면에서는 보통 **5~6분 + API 조회 시간** 안에 반영됩니다. 방문이 없을 때는 동기화를 실행하지 않으며, 다음 방문이 재검증을 수행합니다. 이는 폴링이며 실시간 푸시가 아닙니다.
- 각 갱신은 전체 스냅샷 교체이므로 추가·수정·삭제가 반영됩니다. `syncedAt`은 성공한 스냅샷의 시각이며 오류 시 유지합니다.
- 일시적인 오류는 마지막 정상 콘텐츠를 유지하고 갱신 지연을 표시합니다. 첫 조회 오류는 빈 오류 상태입니다. 명시적 권한 제거, 삭제, 인증 오류는 오래된 콘텐츠를 숨깁니다.
- `429`, `529`, 일시적 서버 실패에 지수 백오프와 `Retry-After`를 적용합니다. 긴 대기 지시는 다음 서버 재시도로 넘깁니다. D1 임대 잠금으로 동시 갱신을 제한합니다.
- 블록/행 페이지네이션 및 일반 블록 재귀 처리. 최대 깊이 30 / 블록 5,000 / 약 90초 예산 초과 시 기존 정상 데이터를 보존합니다.
- Notion 임시 이미지 URL은 저장하거나 렌더링하지 않습니다. 이미지 만료로 깨지는 문제를 피하고 텍스트 경력을 우선합니다. 이미지가 필요한 경우 인증된 프록시 또는 허용된 영구 저장소 연동을 추가해야 합니다.

## 화면과 접근성

고정형 4열 토폴로지, 노드 선택, 관련 관계 강조, 검색, 유형 필터, 확대/축소/이동, 초기화, 키보드로 조작 가능한 목록, 상세 패널을 제공합니다. 모바일에서도 목록으로 동일한 내용에 접근할 수 있습니다. 실제 경력 기간을 알 수 없으므로 누적 연차/성과 지표를 만들어 표시하지 않습니다.

표시되는 개수는 현재 데이터의 경력/프로젝트/기술 항목 수입니다. 선 애니메이션은 선택한 관계를 강조하는 연출이며 트래픽이나 동기화 지표가 아닙니다. `prefers-reduced-motion`, 비활성 탭과 화면 밖 애니메이션 정지를 지원합니다.

## 구조

- `lib/notion-client.ts`: 인증된 공식 API, 재시도, 페이지네이션, 접근 범위
- `lib/notion-parser.ts`: 원문 → 도메인 모델 정규화
- `lib/portfolio.ts`: 공통 타입 및 독립된 데모
- `lib/sync.ts`: 캐시 재검증과 실패 정책 (독립 테스트 가능)
- `lib/notion.ts`: 서버 D1 저장소와 어댑터 연결
- `app/observatory.tsx`: 화면과 탐색 상태
- `db/schema.ts`, `drizzle/`: 영구 스냅샷 스키마 및 마이그레이션

## 배포 (Cloudflare Workers)

배포 대상은 Cloudflare Workers이며 공개 주소는 https://portfolio.yeojs.dev 입니다. Worker 이름, D1 바인딩, 커스텀 도메인은 `wrangler.jsonc`에 정의되어 있고, `@cloudflare/vite-plugin`이 빌드 시 이를 `dist/server/wrangler.json`으로 변환합니다.

```sh
npx wrangler login              # 최초 1회. yeojs.dev 존이 있는 계정으로 로그인
npm run db:migrate:remote       # D1 스키마 변경이 있을 때만
npm run deploy                  # 빌드 후 Worker + 정적 자산 배포
```

Notion 관련 값은 Worker 비밀 값으로 저장합니다. 값이 바뀌면 다시 올립니다. `.env`는 배포에 포함되지 않습니다.

```sh
npx wrangler secret bulk .env --name portfolio-yjs
```

- `routes[].custom_domain: true` 덕분에 `portfolio.yeojs.dev` DNS 레코드와 인증서는 배포 시 자동으로 생성됩니다.
- 로컬 개발(`npm run dev`)은 같은 `wrangler.jsonc`를 읽고 `.env`의 값을 바인딩으로 주입합니다. 로컬 D1은 `npm run db:migrate:local`로 초기화합니다.
- `.openai/hosting.json`과 `build/sites-vite-plugin.ts`는 이전 Sites 호스팅 호환용으로 남아 있으며 Cloudflare 배포에는 사용되지 않습니다.

## 검증 범위

- 타입 검사 및 프로덕션 빌드
- 모의 API 테스트: 중첩/페이지네이션, 접근 범위 제한, 요청 제한 재시도, 안전 URL, 캐시 만료/삭제 반영, 마지막 정상 데이터 유지, 첫 오류, 권한 철회
- 브라우저: 데스크톱, 390px 모바일, 노드 선택, 상세 열기/닫기, 검색 빈 결과, 키보드 탭 전환과 목록 탐색
- 실제 공식 API 조회, 프로필 및 프로젝트 본문, 관계 매핑, D1 저장과 브라우저 반영을 검증했습니다. 원본 변경 금지 조건에 따라 실제 Notion 문서를 수정해 추가/삭제를 시험하지 않았으며, 변경/실패 처리는 모의 API 테스트로 검증했습니다.

## 참고한 공식 자료

- [Datadog Service Map](https://docs.datadoghq.com/tracing/services/services_map/): 관계 중심 탐색과 상세 선택 패턴
- [JENNIFER 5.6.5](https://docs.jennifersoft.com/en/jennifer5_releasenote/75b9c37b5ca54775): 마이크로서비스 토폴로지 구성
- [JENNIFER TopologyChart](https://frontend-design.jennifersoft.com/j5-components/topology-chart): 레이어와 관계 표현
- [Notion 인증](https://developers.notion.com/guides/get-started/authorization)
- [Notion 블록 조회](https://developers.notion.com/reference/get-block-children)
- [Notion 요청 제한](https://developers.notion.com/reference/request-limits)

특정 브랜드의 로고나 화면을 복제하지 않고 차분한 다크 레이어, 청록 강조, 관계별 색상으로 독자적인 UI를 구성했습니다.
