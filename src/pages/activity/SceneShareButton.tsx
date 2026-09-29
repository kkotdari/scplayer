import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { playbackClockOf, playbackSpeedOf, playbackTrackOf, playbackViewOf } from "scplay";

/** 장면 공유 버튼(요청: "scplayer에도 장면 공유 버튼 — 카카오 말고 공유로") ──────────
 *  재생기가 경기별로 적어 두는 지금 장면(시각·배속·배율·가운데 자리·각도·추적)을 읽어
 *  받는 쪽(GameResultStory의 linkQuery)이 아는 규약 그대로 링크에 싣는다:
 *    <지금 경로>?t=<초>&s=<배속>&z=&cx=&cy=&a=<각도>&tr=<추적 아이디>
 *  경기는 **경로**가 가리킨다(/public/playlist/list/2/games/10) — 옛 group/item 쿼리는
 *  안 싣는다(지적: "쓸데없는 파라미터"). 기본값(배속 1·배율 1·각도 90)도 안 싣는다.
 *  보내기는 기기의 공유 시트(navigator.share)를 먼저 쓰고, 없거나 거절되면 링크를 복사한다. */
export default function SceneShareButton({ clockKey, title }: {
  clockKey: string; title: string;
}) {
  const [done, setDone] = useState<null | "shared" | "copied">(null);
  const buildUrl = (): string => {
    const q = new URLSearchParams();
    const t = playbackClockOf.get(clockKey);
    if (t !== undefined && t > 0) q.set("t", String(Math.floor(t)));
    const s = playbackSpeedOf.get(clockKey);
    if (s !== undefined && s > 1) q.set("s", String(s));
    const v = playbackViewOf.get(clockKey);
    if (v) {
      /* ★ 중계가 켜진 채 보낸 장면은 자리(z·cx·cy)가 **비어 온다**(scplay playbackViewOf 의 ★ — 요청: "중계 활성화상태에서
         공유시 위치 좌표 전송 금지") — 그때는 각도만 싣는다. 없는 값은 기본값으로 읽어 아래 문이 저절로 닫힌다. */
      const z = v.z ?? 1;
      const cx = v.cx ?? 0.5;
      const cy = v.cy ?? 0.5;
      if (z > 1.001) q.set("z", z.toFixed(2));
      /* 가운데 자리도 기본값이면 안 싣는다(지적: stargayte처럼 기본값은 빼기) — 1배에서는 팬이 없어
         가운데가 뜻이 없고, 확대해도 지도 한가운데(0.5, 0.5)면 받는 쪽 기본값과 같다. */
      const centered = Math.abs(cx - 0.5) < 0.0005 && Math.abs(cy - 0.5) < 0.0005;
      if (z > 1.001 && !centered) {
        q.set("cx", cx.toFixed(3));
        q.set("cy", cy.toFixed(3));
      }
      if (Math.round(v.deg) !== 90) q.set("a", String(Math.round(v.deg)));
    }
    /* 추적 중인 사람(&tr=) — 재생기가 이제 실제로 적어 준다(scplay 2026-09: 표만 있고 적는 자리가 없었다). */
    const tr = playbackTrackOf.get(clockKey);
    if (tr) q.set("tr", tr);
    return `${window.location.origin}${window.location.pathname}?${q.toString()}`;
  };
  const copy = async (url: string): Promise<void> => {
    await navigator.clipboard.writeText(url);
    setDone("copied");
  };
  const onClick = async (): Promise<void> => {
    const url = buildUrl();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        setDone("shared");
      } else {
        await copy(url);
      }
    } catch {
      // 공유 시트를 닫았거나 못 쓰는 환경 — 링크 복사로 물러난다.
      try { await copy(url); } catch { /* 클립보드도 막힌 환경 — 조용히 둔다 */ }
    }
    window.setTimeout(() => setDone(null), 1800);
  };
  /* 단축키 X(요청: 키 매핑 변경 — 스크랩/공유 z/x; 옛 P) — 재생기의 키 판(scplay)은 Z·X를 안 쓰므로 여기서 창에 직접
     듣는다. 글을 치는 칸·수식키에서는 안 듣고, 한글 자판에서도 듣도록 키 자리(e.code)로 본다. 최신 onClick은 ref로 든다. */
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== "KeyX" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      void onClickRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <button type="button" className="scr-kakao-share-btn" onClick={() => { void onClick(); }} aria-label="장면 공유">
      {done === "copied" ? <Check /> : <Share2 />}
      {done === "copied" ? "링크 복사됨" : done === "shared" ? "공유됨" : "장면 공유"}
    </button>
  );
}
