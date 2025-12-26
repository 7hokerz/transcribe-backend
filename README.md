
# 오디오 음성 추출 최적화 (Backend)

## 기술 스택
- Node.js v24.12.0
- Express v5.2.1

# 주요 문제 해결 주제 요약

## 1. 스트리밍 아키텍처 구성

### 문제
- 전체 오디오 파일 로드로 인한 메모리 점유율 증가

### 해결
- 스토리지 → 서버 → OpenAI API 스트림 파이프라인 구축
- 결과: 기존 대비 Heap 97% 감소, RSS (Resident Set Size) 99% 감소

## 2. 스트림 누수 방지

### 문제
- 예외 상황에서 스트림이 닫히지 않아 메모리 누수 발생, 커넥션 풀 고갈

### 해결
- try-with-resources 패턴으로 어떤 상황에서도 반드시 스트림 해제

## 3. HTTP 커넥션 풀 구성

### 문제
- fetch 기반 전역 에이전트는 리소스 경합 발생 확률 증가
- API 별 옵션 설정 미비

### 해결
- Undici.Pool 기반 오디오 처리용 커넥션 풀 구축
- 타임아웃, 커넥션 수 등 옵션 설정

## 4. 비동기 & 큐
    
### 문제
- 커넥션 점유 및 블로킹 시간 증가
- 동시성 제어 어려움

### 해결
- 요청 즉시 반환으로 비동기 처리
- 인메모리 큐: 동시성 제어 및 우선순위 기반 작업 처리 보장

---

## 개요
- TypeScript 기반 Express API 서버로, Cloud Storage `audios/{userId}/{sessionId}/` 경로에 업로드된 오디오 청크를 ffprobe로 검증한 뒤 OpenAI API로 텍스트를 추출합니다.
- HMAC 헤더 기반의 전용 클라이언트 인증을 사용하며, 작업 상태/결과는 Firestore(`content-cache` 컬렉션)와 Storage 메타데이터를 통해 관리됩니다.
- 개발 환경에서는 `/docs`(Swagger UI)와 `/health` 헬스 체크가 열립니다.

## 주요 구성 흐름
1) 클라이언트가 `/api/v1/transcription`에 세션 정보를 제출합니다.
2) `SessionQueue` → `FFprobeQueue`(코덱/길이 검증) → `TranscribeQueue`(OpenAI 전송) 순서로 처리하며, 큐는 `p-queue`로 rate-limit 및 동시성 제어를 합니다.
3) 성공 시 청크별 텍스트를 병합해 Firestore에 저장하고, 10분 TTL 캐시 메타를 기록합니다. 실패/예외 시 상태를 `FAILED`로 업데이트합니다.

## 사전 요구사항
- Node.js 22+, npm 10+
- Firebase Admin이 접근 가능한 서비스 계정(Realtime Database, Firestore, Storage 권한 포함)
- ffprobe 바이너리(로컬 실행 시 필요). Docker 이미지는 ffprobe를 내장 빌드합니다.

## 환경 변수
`.env` 또는 `.env.docker`에 아래 값을 설정하세요(민감 정보는 예시 값으로 대체해 주세요).
- `API_SECRET_KEY`: HMAC 서명에 사용하는 서버 비밀키
- `FIREBASE_SERVICE_ACCOUNT_KEY`: 서비스 계정 JSON 문자열 전체
- `OPENAI_API_KEY`: OpenAI API 키
- `PORT`: (선택) 서버 포트, 기본 8080
- `NODE_ENV`: `development`로 두면 `/docs`가 활성화됩니다.

## 로컬 개발
```bash
npm install
npm run dev            # nodemon + tsx, .env 로드
```

타입 빌드: `npm run build`
프로덕션 번들 실행(빌드 후): `npm start`

## Docker 실행
```bash
docker compose up --build
# 또는 필요 시
# docker build -t transcribe-backend .
# docker run --env-file .env.docker -p 8080:8080 transcribe-backend
```

## API 개요
- `GET /health`: 단순 헬스 체크
- `POST /api/v1/transcription`: 세션 제출. Storage 경로 `audios/{userId}/{sessionId}/`에 있는 오디오 청크를 대상으로 처리합니다. 응답: `202 { "jobId": <sessionId> }`
- Swagger: 개발 모드(`NODE_ENV=development`)에서만 `/docs` (localhost/127.0.0.1 접근 제한)

### 인증 헤더 (HMAC)
- 필수 헤더: `User-Agent: QuizGenApp/1.0`, `X-Signature`, `X-Timestamp`(epoch ms), `X-Nonce`(32 hex, 요청마다 고유)
- 서명 메시지: `${METHOD}${PATH}${body}${timestamp}${nonce}` 를 `API_SECRET_KEY`로 HMAC-SHA256 후 hex 인코딩

## 폴더 개요
- `src/app.ts`, `src/server.ts`: Express 앱 부트스트랩 및 서버 기동
- `src/routes/` + `src/controllers/`: API 라우트와 엔드포인트 진입점
- `src/middlewares/auth.middleware.ts`: HMAC 인증/nonce 검증
- `src/queues/`: ffprobe/transcribe 작업 큐 구성
- `src/services/`: ffprobe 실행, OpenAI 전송, Firestore/Storage 저장 로직
- `src/config/`: CORS/압축/오류 처리, Firebase Admin 설정
- `swagger.yml`: OpenAPI 스펙 (개발 모드에서 `/docs` UI)

## 참고
- ffprobe 타임아웃/형식 검증 실패 시 400(Validation) 또는 502(외부 연동 실패) 코드가 반환됩니다.
- 캐시 TTL(기본 10분) 이후에는 Firestore `content-cache` 문서가 만료될 수 있으니 조회 로직에서 유의하세요.
