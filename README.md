# scplayer — 스타크래프트 리플레이 재생기 (공개 사이트)

외부에 공개하는 재생 목록 사이트다. 재생 엔진은 [scplay](https://github.com/kkotdari/scplay)
패키지가 들고 오고, 이 저장소에는 **사이트의 것**(목록·비밀번호 문·상세 화면·API 호출)만 있다.

## 돌리기

```bash
npm install                      # scplay는 github:kkotdari/scplay에서 받아 자동 빌드된다
cp .env.example .env.local       # VITE_API_BASE = stargayte-api 주소
npm run dev
```

## 구조

- 화면 하나다(`ExtShareScreen`) — 로그인도 메뉴도 없다. 라이트 테마 고정.
- 데이터는 stargayte-api의 공개 문 둘: `/api/public/share`(목록 이름), `/api/restricted/share`
  (경기·맵·자취 — 목록 비밀번호를 헤더로 대조).
- `main.tsx`가 scplay에 앱의 것을 꽂는다(맵 가져오는 길·프사·토스트) — 패키지는 API 주소를
  모른다.
- `styles/global.css`에는 재생기 규칙이 없다 — `scplay/styles.css`가 들고 온다(import 차례가
  앞뒤를 지킨다).

## 배포 (Vercel)

저장소 연결 + 환경변수 `VITE_API_BASE`만 넣으면 끝. SPA 되돌림은 `vercel.json`에 있다.
