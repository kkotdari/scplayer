import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Boxes, Lock, Play } from "lucide-react";
import GameResultStory from "../activity/GameResultStory";
import GuideScreen from "../guide/GuideScreen";
import GalleryScreen from "../gallery/GalleryScreen";
import { LoadingMark, Spinner } from "../../components/common/Feedback";
import { api, setExtShareContext } from "../../api/client";
import { cleanMapName } from "../../utils/mapName";
import { forceLightTheme } from "../../utils/theme";
import type { ExtShareGame, ExtShareList } from "../../types";
const PASS_KEY = "stargayte_extshare_pass";
function readPasses(): Record<string, string> {
    try {
        return JSON.parse(window.localStorage.getItem(PASS_KEY) || "{}") as Record<string, string>;
    }
    catch {
        return {};
    }
}
function writePass(listId: number, pass: string): void {
    try {
        const all = readPasses();
        all[String(listId)] = pass;
        window.localStorage.setItem(PASS_KEY, JSON.stringify(all));
    }
    catch {
    }
}
/** 그 판을 부르는 이름 — **사람이 지은 제목이 먼저**고, 없으면 선수 이름을 vs로 잇는다.
 *  스타게이트 쪽 extShareGameTitle과 같은 규칙이다 — 두 화면이 같은 판을 다른 말로
 *  부르면 안 된다. **관전자는 안 센다**(스타게이트도 같이 걷는다) — 판을 든 사람만
 *  이름에 오른다. */
function gameTitleOf(g: ExtShareGame): string {
    const made = (g.title ?? "").trim();
    if (made)
        return made;
    const names = [...g.team1, ...g.team2]
        .filter((s) => !s.observer)
        .map((s) => s.rawName || s.memberId).filter(Boolean);
    return names.length > 0 ? names.join(" vs ") : "이름 없는 판";
}
const PATH = "/public/playlist";
const TITLE = "스타크래프트 리플레이 재생기";
/** 제목 밑 한 줄 — 첫 화면(목록도 판도 안 고른 자리)에서만 선다. 탭 이름은 TITLE 그대로다. */
const SUBTITLE = "볼만한 리플레이 모음";
const PUBLIC_SCREEN = "public_playlist";
function listFromUrl(): number | null {
    const v = Number(new URLSearchParams(window.location.search).get("list"));
    return Number.isFinite(v) && v > 0 ? v : null;
}
/** 지금 열린 판 — 목록과 같은 결로 주소에 적는다(?list=3&game=10). */
function gameFromUrl(): number | null {
    const v = Number(new URLSearchParams(window.location.search).get("game"));
    return Number.isFinite(v) && v > 0 ? v : null;
}
/** 주소를 지금 자리에 맞춘다.
 *  push면 뒤로가기가 짚을 자리가 하나 생긴다 — 판을 열 때만 그렇게 한다. 목록 이동은
 *  종전대로 replace다(그래야 목록에서 뒤로가기가 이 사이트 밖으로 나간다 — 이 앱은
 *  화면이 하나뿐이라 목록이 곧 첫 자리다). */
/** 도록의 갈래 ↔ 주소 값 — 주소에는 한글을 안 싣는다(공유·로그에서 깨진다). */
const DOC_SLUG = { "유닛": "unit", "건물": "bld", "부가": "aux" } as const;
type DocGroup = keyof typeof DOC_SLUG;
function docFromUrl(): DocGroup | null {
    const v = new URLSearchParams(window.location.search).get("doc");
    const hit = (Object.keys(DOC_SLUG) as DocGroup[]).find((k) => DOC_SLUG[k] === v);
    return hit ?? null;
}
function setUrl(listId: number | null, gameId: number | null, push = false, doc: DocGroup | null = null): void {
    const params = new URLSearchParams();
    /* 도록은 목록·판과 **같은 자리를 안 쓴다** — 도록에 있는 동안 list/game은 뜻이 없다.
       한 칸만 실어야 뒤로가기가 두 화면 사이를 오간다. */
    if (doc !== null) {
        const url9 = `${PATH}?doc=${DOC_SLUG[doc]}`;
        if (push)
            window.history.pushState(null, "", url9);
        else
            window.history.replaceState(null, "", url9);
        return;
    }
    if (listId !== null)
        params.set("list", String(listId));
    if (gameId !== null)
        params.set("game", String(gameId));
    const qs = params.toString();
    const url = `${PATH}${qs ? `?${qs}` : ""}`;
    if (push)
        window.history.pushState(null, "", url);
    else
        window.history.replaceState(null, "", url);
}
export default function ExtShareScreen() {
    const [lists, setLists] = useState<ExtShareList[] | null>(null);
    const [listId, setListId] = useState<number | null>(listFromUrl);
    const [pass, setPass] = useState("");
    const [typed, setTyped] = useState("");
    const [games, setGames] = useState<ExtShareGame[] | null>(null);
    const [openId, setOpenId] = useState<number | null>(gameFromUrl);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [guide, setGuide] = useState(false);
    /** 도록을 보고 있나 — 갈래(유닛·건물·그 밖)가 곧 그 페이지다. */
    const [doc, setDoc] = useState<DocGroup | null>(docFromUrl);
    const memberOf = useCallback(() => undefined, []);
    useEffect(() => forceLightTheme(), []);
    /** 우리가 밀어 넣은 자리인가 — 닫기 버튼이 history.back()을 써도 되는지가 여기 달렸다.
     *  주소를 그대로 받아 들어온 사람(공유 링크)의 뒤에는 우리 자리가 없어서, 그때
     *  back()을 부르면 사이트 밖으로 나간다. */
    const pushed = useRef(false);
    useEffect(() => {
        setUrl(listFromUrl(), gameFromUrl(), false, docFromUrl());
    }, []);
    /* 뒤로·앞으로 — 주소가 참이고 화면이 그것을 따른다. */
    useEffect(() => {
        const onPop = (): void => {
            const l = listFromUrl();
            const g = gameFromUrl();
            pushed.current = false;
            setDoc(docFromUrl());
            setListId(l);
            setOpenId(g);
            if (l === null) {
                setGames(null);
                setErr("");
            }
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);
    useEffect(() => {
        void api.pingPublicAccess(PUBLIC_SCREEN, listId === null ? undefined : `list#${listId}`);
    }, [listId]);
    useEffect(() => {
        let dead = false;
        api.getExtShareLists()
            .then((rows) => { if (!dead)
            setLists(rows); })
            .catch(() => { if (!dead)
            setLists([]); });
        return () => { dead = true; };
    }, []);
    const current = useMemo(() => (listId === null ? null : lists?.find((l) => l.id === listId) ?? null), [lists, listId]);
    useEffect(() => {
        if (listId === null || !lists)
            return undefined;
        const row = lists.find((l) => l.id === listId);
        if (!row)
            return undefined;
        const saved = row.locked ? (readPasses()[String(listId)] ?? "") : "";
        if (row.locked && !saved) {
            setPass("");
            setGames(null);
            return undefined;
        }
        setPass(saved);
        return undefined;
    }, [listId, lists]);
    useEffect(() => {
        if (listId === null) {
            setExtShareContext(null);
            return undefined;
        }
        setExtShareContext({ listId, pass });
        return () => setExtShareContext(null);
    }, [listId, pass]);
    useEffect(() => {
        if (listId === null || !current)
            return undefined;
        if (current.locked && !pass)
            return undefined;
        let dead = false;
        setBusy(true);
        api.getExtShareGames(listId, pass)
            .then((rows) => { if (!dead) {
            setGames(rows);
            setErr("");
        } })
            .catch((e: Error) => {
            if (dead)
                return;
            setGames(null);
            setPass("");
            setErr(e.message || "목록을 받지 못했어요.");
        })
            .finally(() => { if (!dead)
            setBusy(false); });
        return () => { dead = true; };
    }, [listId, current, pass]);
    const submitPass = async (): Promise<void> => {
        if (listId === null)
            return;
        setBusy(true);
        setErr("");
        try {
            await api.enterExtShare(listId, typed);
            writePass(listId, typed);
            setPass(typed);
            setTyped("");
        }
        catch (e) {
            setErr((e as Error).message || "비밀번호가 맞지 않습니다.");
        }
        finally {
            setBusy(false);
        }
    };
    const goList = (id: number | null): void => {
        setListId(id);
        setOpenId(null);
        setGames(null);
        setErr("");
        pushed.current = false;
        setUrl(id, null);
    };
    /** 도록을 연다 — 뒤로가기가 짚을 자리를 하나 민다(판을 열 때와 같은 규약). */
    const openDoc = (g: DocGroup): void => {
        setDoc(g);
        setUrl(null, null, doc === null, g);
        if (doc === null)
            pushed.current = true;
    };
    /** 도록을 닫는다 — 우리가 민 자리면 뒤로 물러서고, 받아 들어온 주소면 주소만 되돌린다. */
    const closeDoc = (): void => {
        if (pushed.current) {
            window.history.back();
            return;
        }
        setDoc(null);
        setUrl(listId, null);
    };
    const openGame = (id: number): void => {
        setOpenId(id);
        setUrl(listId, id, true);
        pushed.current = true;
    };
    /** 판을 닫는다 — 우리가 민 자리면 뒤로 물러서고(그 자리가 쌓이지 않는다), 받아 들어온
     *  주소면 자리를 만들지 않고 주소만 목록으로 되돌린다. */
    const closeGame = (): void => {
        if (pushed.current) {
            window.history.back();
            return;
        }
        setOpenId(null);
        setUrl(listId, null);
    };
    const open = openId === null ? null : games?.find((g) => g.id === openId) ?? null;
    /* 주소가 가리키는 판이 이 목록에 없다 — 지워졌거나 남의 목록의 번호다. 조용히 목록으로
       돌리되 주소도 함께 턴다(안 그러면 뒤로가기가 없는 판을 다시 짚는다). */
    useEffect(() => {
        if (openId === null || games === null)
            return;
        if (!games.some((g) => g.id === openId)) {
            setOpenId(null);
            setUrl(listId, null);
        }
    }, [games, openId, listId]);
    /* 탭 이름 — 히스토리 목록에서 판끼리 갈리려면 자리마다 이름이 달라야 한다. */
    useEffect(() => {
        document.title = doc ? `모델 도록 — ${TITLE}`
            : open ? `${gameTitleOf(open)} — ${TITLE}` : TITLE;
    }, [open, doc]);
    return (<div className="scr-app scr-app-fallback-scroll scr-extshare" id="scr-app">
      <div className="scr-bg-grid"/>
      <div id="scroll-root">
        <main className="scr-main scr-extshare-main">
          
          <header className="scr-crumb">
            {(listId !== null || open || doc) && (<button type="button" className="scr-crumb-back" onClick={() => (doc ? closeDoc() : open ? closeGame() : goList(null))}>
                <ArrowLeft size={16}/>
                <span>{doc ? "재생 목록" : open ? "목록" : "전체 목록"}</span>
              </button>)}

            <h1 className="scr-crumb-title">
              {doc ? "모델 도록" : open ? gameTitleOf(open) : current?.name ?? (<>
                {TITLE}
                <span className="scr-crumb-subtitle">{SUBTITLE}</span>
              </>)}
            </h1>
            
            {/* 도록 문 — 첫 화면 **상단 우측**이다(요청). 목록 안·판 안에서는 안 낸다:
                거기서는 '사용법'이 그 자리를 쓰고, 도록은 목록과 무관한 자료실이다. */}
            {listId === null && !doc && (<button type="button" className="scr-crumb-guide scr-crumb-doc" onClick={() => openDoc("유닛")}>
                <Boxes size={13}/>
                <span>도록</span>
              </button>)}
            {listId !== null && (<button type="button" className="scr-crumb-guide" onClick={() => setGuide(true)}>
                <BookOpen size={13}/>
                <span>사용법</span>
              </button>)}
          </header>

          
          {doc && <GalleryScreen group={doc} onGroup={openDoc} onClose={closeDoc}/>}

          {!doc && listId === null && (lists === null ? <LoadingMark /> : (<div className="scr-extshare-lists">
                {lists.length === 0 && (<p className="scr-extshare-empty">아직 공개된 재생 목록이 없습니다.</p>)}
                {lists.map((l) => (<button type="button" key={l.id} className="scr-extshare-listcard" onClick={() => goList(l.id)}>
                    <span className="scr-extshare-listname">{l.name}</span>
                    <span className="scr-extshare-listmeta">
                      {l.locked && <Lock size={12} aria-label="비밀번호"/>}
                      {l.gameCount}판
                    </span>
                  </button>))}
              </div>))}

          
          {!doc && listId !== null && current?.locked && !pass && (<form className="scr-extshare-gate" onSubmit={(e) => { e.preventDefault(); void submitPass(); }}>
              <Lock size={22}/>
              <p>이 목록은 비밀번호가 필요합니다.</p>
              <input type="password" value={typed} autoFocus onChange={(e) => setTyped(e.target.value)} placeholder="비밀번호"/>
              <button type="submit" disabled={busy || !typed}>
                {busy ? <Spinner size={14}/> : "들어가기"}
              </button>
              {err && <span className="scr-extshare-err">{err}</span>}
            </form>)}

          
          {!doc && listId !== null && !open && (current ? !current.locked || !!pass : false) && (games === null ? <LoadingMark /> : (<div className="scr-extshare-games">
                {games.length === 0 && (<p className="scr-extshare-empty">이 목록에는 아직 경기가 없습니다.</p>)}
                {games.map((g) => {
                const mins = g.durationSeconds != null
                    ? Math.round(g.durationSeconds / 60) : null;
                return (<button type="button" key={g.id} className="scr-extshare-game" onClick={() => openGame(g.id)}>
                      <Play size={14} className="scr-extshare-gameicon"/>
                      <span className="scr-extshare-gamenames">{gameTitleOf(g)}</span>
                      <span className="scr-extshare-gamemeta">
                        {cleanMapName(g.mapName) && <span>{cleanMapName(g.mapName)}</span>}
                        {mins !== null && <span>{mins}분</span>}
                        {g.date && <span>{g.date}</span>}
                      </span>
                    </button>);
            })}
              </div>))}

          
          {!doc && open && (<div className="scr-extshare-detail">
              <GameResultStory gameResult={open} team1={open.team1} team2={open.team2} result={open.result} memberOf={memberOf} extShare/>
            </div>)}
          {busy && listId !== null && games !== null && <Spinner size={16}/>}
        </main>
        {guide && (<div className="scr-extshare-guide">
            <GuideScreen onClose={() => setGuide(false)}/>
          </div>)}
      </div>
    </div>);
}
