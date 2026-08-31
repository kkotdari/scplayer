import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Lock, Play, Shapes } from "lucide-react";
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
/** 도록의 갈래 ↔ 주소 값 — 주소에는 한글을 안 싣는다(공유·로그에서 깨진다). */
const DOC_SLUG = { "유닛": "unit", "건물": "bld", "부가": "aux" } as const;
type DocGroup = keyof typeof DOC_SLUG;
/* ★ 화면을 **경로**로 적는다(요청: "파라미터로 페이징 하는 방식이 좀 별로") ─────────────
   여태는 자리가 늘 /public/playlist 하나였고 ?list=·?game=·?doc=만 갈렸다. 그래서
     ① 주소만 봐서는 어느 화면인지 안 읽히고,
     ② 무엇보다 **사용법은 주소에 아예 없었다** — 리액트 상태로만 떠서, 사용법을 켠 채
        뒤로가기를 누르면 뒤의 자리(판·목록)로 물러나면서 덮개는 그대로 남았다. 닫기와
        뒤로가기가 서로 다른 데로 가던 것이 이것이다(지적).
   이제 화면마다 제 마디를 가진다:
     /public/playlist                        전체 목록
     /public/playlist/list/2                 목록 2
     /public/playlist/list/2/games/10        그 목록의 판 10
     /public/playlist/list/2/games/10/guide  그 위에 뜬 사용법
     /public/playlist/doc/unit               도록(유닛)
   호스팅이 모든 경로를 index.html로 돌려주므로(vercel.json의 rewrites) 새로고침도
   공유도 그대로 된다. */
/** 지금 서 있는 화면 — 주소가 참이고 화면이 이것을 따른다. */
type Route = {
    list: number | null;
    game: number | null;
    doc: DocGroup | null;
    guide: boolean;
};
const HOME: Route = { list: null, game: null, doc: null, guide: false };
function routeFromUrl(): Route {
    const p = window.location.pathname;
    if (!p.startsWith(PATH))
        return HOME;
    const seg = p.slice(PATH.length).split("/").filter(Boolean);
    const r: Route = { ...HOME };
    for (let i = 0; i < seg.length; i += 1) {
        const head = seg[i];
        if (head === "guide") {
            r.guide = true;
            continue;
        }
        const arg = seg[i + 1];
        if (arg === undefined)
            break;
        i += 1;
        const n = Number(arg);
        if (head === "list" && Number.isFinite(n) && n > 0)
            r.list = n;
        else if (head === "games" && Number.isFinite(n) && n > 0)
            r.game = n;
        else if (head === "doc")
            r.doc = (Object.keys(DOC_SLUG) as DocGroup[]).find((k) => DOC_SLUG[k] === arg) ?? null;
    }
    /* 어긋난 주소는 손질한다 — 판은 목록 안에서만 뜻이 있고, 도록은 목록·판과 같은 자리를
       안 쓴다(도록에 있는 동안 list/game은 뜻이 없다). */
    if (r.doc !== null)
        return { list: null, game: null, doc: r.doc, guide: r.guide };
    if (r.list === null)
        r.game = null;
    return r;
}
/** 그 화면의 주소. */
function pathOf(r: Route): string {
    let p = PATH;
    if (r.doc !== null)
        p += `/doc/${DOC_SLUG[r.doc]}`;
    else {
        if (r.list !== null)
            p += `/list/${r.list}`;
        if (r.list !== null && r.game !== null)
            p += `/games/${r.game}`;
    }
    return r.guide ? `${p}/guide` : p;
}
/** 한 단계 위 — 뒤로 물러설 자리가 없을 때 닫기가 갈 곳이다. */
function parentOf(r: Route): Route {
    if (r.guide)
        return { ...r, guide: false };
    if (r.doc !== null)
        return HOME;
    if (r.game !== null)
        return { ...r, game: null };
    return HOME;
}
/* ★ 뒤로 물러설 자리가 있나 — **우리가 민 자리에만 표를 박는다** ─────────────────────
   여태는 pushed라는 불리언 하나로 갈랐다. 화면이 넷이 되면서 그 하나가 곧 거짓말이
   됐다: 판을 밀고(pushed=true) 사용법을 켜면(주소를 안 건드림) 판의 표가 사용법 것으로
   읽혀, 사용법 닫기가 판까지 함께 닫았다. 표를 history 자리마다 박으면 표가 자리와 함께
   앞뒤로 오가므로 셈이 틀어지지 않는다. 표가 없는 자리는 공유 링크로 **받아 들어온 첫
   자리**라, 거기서 back()을 부르면 사이트 밖으로 나간다 — 그때만 주소를 되돌린다. */
function depthOf(): number {
    const s = window.history.state as { scr?: unknown } | null;
    return typeof s?.scr === "number" ? s.scr : 0;
}
/* 경로는 **화면**, 쿼리는 **옵션**이다(요청: "games/2?speed=2 예를들어 이런스타일").
   재생기가 ?perf=1·?dpr=·?hide=·?gap=·?noshadow=1을 주소에서 읽으므로, 화면을 옮기며
   경로만 갈아 끼우고 쿼리는 손대지 않고 얹는다 — 안 그러면 첫 replaceState 한 번에
   옵션이 통째로 날아간다. */
function writeUrl(r: Route, push: boolean): void {
    /* ★ **해시도 그대로 얹는다**(지적: "#diag 붙여서 치면 없어지고 일반 주소로 가") —
       쿼리를 지키는 것과 똑같은 까닭이다. 재생기의 진단 오버레이는 주소 끝의 `#diag`로
       켜지는데, 뜨자마자 도는 첫 replaceState가 경로 + 쿼리만으로 주소를 다시 써서
       해시를 통째로 지웠다. 그래서 폰에서 진단을 켤 길이 아예 없었다.
       ★ 여기서 지키지 않으면 다른 데서 살릴 방법이 없다 — 주소를 다시 쓰는 자리가
         이 함수 하나뿐이라, 이 한 줄이 곧 '주소에서 무엇을 지키나'의 전부다. */
    const url = pathOf(r) + window.location.search + window.location.hash;
    if (push)
        window.history.pushState({ scr: depthOf() + 1 }, "", url);
    else
        window.history.replaceState({ scr: depthOf() }, "", url);
}
export default function ExtShareScreen() {
    const [lists, setLists] = useState<ExtShareList[] | null>(null);
    const [pass, setPass] = useState("");
    const [typed, setTyped] = useState("");
    const [games, setGames] = useState<ExtShareGame[] | null>(null);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    /* 화면은 **하나의 값**이다 — 목록·판·도록·사용법을 따로 든 상태 넷이 서로 어긋나던
       것을 한 자리로 모은다(그 어긋남이 곧 닫기·뒤로가기가 딴 데로 가던 까닭이다). */
    const [route, setRoute] = useState<Route>(routeFromUrl);
    const { list: listId, game: openId, doc, guide } = route;
    const memberOf = useCallback(() => undefined, []);
    useEffect(() => forceLightTheme(), []);
    /** 화면을 옮긴다 — 상태와 주소를 한 손으로 민다. */
    const nav = useCallback((r: Route, push: boolean): void => {
        writeUrl(r, push);
        setRoute(r);
    }, []);
    /** 닫기 — 우리가 민 자리면 뒤로 물러서고(자리가 안 쌓인다), 받아 들어온 주소면
     *  자리를 안 만들고 주소만 한 단계 위로 되돌린다. */
    const goBack = useCallback((): void => {
        if (depthOf() > 0) {
            window.history.back();
            return;
        }
        nav(parentOf(routeFromUrl()), false);
    }, [nav]);
    /* 첫 자리를 반듯이 한다 — 어긋난 경로(/ 나 옛 ?list= 주소)를 제 자리로 옮기고,
       이 자리에 표를 박는다(depthOf가 0이라 닫기가 back()을 안 부른다). */
    useEffect(() => {
        writeUrl(routeFromUrl(), false);
    }, []);
    /* 뒤로·앞으로 — 주소가 참이고 화면이 그것을 따른다. */
    useEffect(() => {
        const onPop = (): void => { setRoute(routeFromUrl()); };
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
    /* 목록이 갈리면 들고 있던 판 목록은 남의 것이다 — 새로 받을 때까지 비운다. 종전에는
       goList와 popstate가 저마다 손으로 지웠는데, 옮기는 길이 여럿이라 한 군데씩 빠졌다.
       아래 받아 오는 갈래보다 **먼저** 서야 지운 뒤에 받는다(효과는 적은 차례로 돈다). */
    useEffect(() => {
        setGames(null);
        setErr("");
    }, [listId]);
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
    /** 목록으로 들어간다 — 제 경로(/list/2)를 가지므로 자리를 민다. */
    const openList = (id: number): void => { nav({ ...HOME, list: id }, true); };
    /** 도록을 연다. 갈래를 갈아 끼우는 것(유닛↔건물)은 같은 화면 안이라 자리를 안 쌓는다. */
    const openDoc = (g: DocGroup): void => { nav({ ...HOME, doc: g }, doc === null); };
    const openGame = (id: number): void => { nav({ ...route, game: id }, true); };
    /** 사용법 — 이제 제 마디(.../guide)를 가진다. 그래서 뒤로가기가 이것부터 닫는다. */
    const openGuide = (): void => { nav({ ...route, guide: true }, true); };
    const open = openId === null ? null : games?.find((g) => g.id === openId) ?? null;
    /* 주소가 가리키는 판이 이 목록에 없다 — 지워졌거나 남의 목록의 번호다. 조용히 목록으로
       돌리되 주소도 함께 턴다(안 그러면 뒤로가기가 없는 판을 다시 짚는다). */
    useEffect(() => {
        if (openId === null || games === null)
            return;
        if (!games.some((g) => g.id === openId))
            nav({ ...routeFromUrl(), game: null }, false);
    }, [games, openId, nav]);
    /* 탭 이름 — 히스토리 목록에서 판끼리 갈리려면 자리마다 이름이 달라야 한다. */
    useEffect(() => {
        document.title = guide ? `사용법 — ${TITLE}`
            : doc ? `모델 도록 — ${TITLE}`
                : open ? `${gameTitleOf(open)} — ${TITLE}` : TITLE;
    }, [open, doc, guide]);
    return (<div className="scr-app scr-app-fallback-scroll scr-extshare" id="scr-app">
      <div className="scr-bg-grid"/>
      <div id="scroll-root">
        <main className="scr-main scr-extshare-main">
          
          <header className="scr-crumb">
            {(listId !== null || open || doc) && (<button type="button" className="scr-crumb-back" onClick={goBack}>
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
                <Shapes size={13}/>
                <span>도록</span>
              </button>)}
            {listId !== null && (<button type="button" className="scr-crumb-guide" onClick={openGuide}>
                <BookOpen size={13}/>
                <span>사용법</span>
              </button>)}
          </header>

          
          {doc && <GalleryScreen group={doc} onGroup={openDoc} onClose={goBack}/>}

          {!doc && listId === null && (lists === null ? <LoadingMark /> : (<div className="scr-extshare-lists">
                {lists.length === 0 && (<p className="scr-extshare-empty">아직 공개된 재생 목록이 없습니다.</p>)}
                {lists.map((l) => (<button type="button" key={l.id} className="scr-extshare-listcard" onClick={() => openList(l.id)}>
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
            <GuideScreen onClose={goBack}/>
          </div>)}
      </div>
    </div>);
}
