import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
// 재생기 화장은 앱 공통 CSS **뒤에** — 같은 특이도의 앞뒤가 규칙이다(scplay README).
import "scplay/styles.css";
import { setReplayChrome, setReplayMapFetcher } from "scplay";
import ExtShareScreen from "./pages/extShare/ExtShareScreen";
import Avatar from "./components/common/Avatar";
import ToastHost, { showToast } from "./components/common/Toast";
import { api } from "./api/client";

/* scplay에 앱의 것을 꽂는다 — 패키지는 API 주소도 프사도 토스트도 모른다. */
setReplayMapFetcher((hashes) => api.getReplayMaps(hashes));
setReplayChrome({ Avatar, toast: (text, opts) => { showToast(text, opts as never); } });

// 이 앱은 화면이 하나다 — 공개 재생 목록. 로그인도 레일도 없다.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ExtShareScreen />
    {/* 토스트 그릇 — showToast는 목록에 넣을 뿐이라 이것이 있어야 화면에 뜬다(지적: 모바일 3D 버튼 토스트가 안 뜸).
        body에 포털로 붙고 전체화면은 documentElement라 전체화면 안에서도 보인다. */}
    <ToastHost />
  </StrictMode>,
);
