import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { sceneLinkQueryOf9 } from "scplay";

/** 장면 공유 버튼(요청: "scplayer에도 장면 공유 버튼 — 카카오 말고 공유로") ──────────
 *  링크의 쿼리(t·s·z·cx·cy·a·tr)는 **재생기가 통째로 만든다**(scplay `sceneLinkQueryOf9` — 2026-09, 요청:
 *  "파라미터공유하는거 scplay에서 파라미터를 싹 만들어서 주고 그걸 인자로 받아서 각 사용처에서 그걸 전달하는 식으로
 *  하면 안되나 가공 없이"). 어느 값을 기본값으로 안 싣나 · 중계·추적 중에는 자리 대신 `&tr=` 을 싣나는 다 그쪽 규약이고,
 *  여기는 그것을 **지금 경로 뒤에 그대로 붙일 뿐**이다. 경기는 경로가 가리킨다(/public/playlist/list/2/games/10 —
 *  옛 group/item 쿼리는 안 싣는다 · 지적: "쓸데없는 파라미터"). 받는 쪽은 GameResultStory 가 `sceneLinkOf9` 로 푼다.
 *  보내기는 기기의 공유 시트(navigator.share)를 먼저 쓰고, 없거나 거절되면 링크를 복사한다. */
export default function SceneShareButton({ clockKey, title }: {
  clockKey: string; title: string;
}) {
  const [done, setDone] = useState<null | "shared" | "copied">(null);
  const buildUrl = (): string =>
    `${window.location.origin}${window.location.pathname}?${sceneLinkQueryOf9(clockKey).toString()}`;
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
