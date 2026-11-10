# 문서안심

금융문서 PDF의 민감정보를 Upstage Studio 워크플로우로 검사하는 데모입니다.

## 환경변수

1. `.env.example`을 복사해서 `.env.local`을 만듭니다.
2. `UPSTAGE_API_KEY`에 Upstage에서 발급받은 실제 키를 넣습니다.
3. `UPSTAGE_AGENT_ID`가 사용할 Studio 워크플로우의 값인지 확인합니다. `UPSTAGE_CONFIG_ID`는 설정 버전이며, 작업 생성 요청의 `config_id`에 문자열 `"3"`으로 전달됩니다.
4. `UPSTAGE_PROJECT_ID`가 모든 Upstage 요청의 `x-project-id` 헤더에 들어가는지 확인합니다.
5. 개발 서버를 재시작합니다.
6. 배포할 때는 배포 서비스의 서버 환경변수에도 같은 값을 등록합니다.

API 키는 서버에서만 읽습니다. 로그나 브라우저 응답에 넣지 않고, `NEXT_PUBLIC_` 접두사도 붙이지 마세요.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 포트가 사용 중이면 터미널에 표시된 주소를 사용합니다.
