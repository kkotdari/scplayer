import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Lock, Play } from "lucide-react";
import GameResultStory from "../activity/GameResultStory";
import GuideScreen from "../guide/GuideScreen";
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
function setUrlList(listId: number | null): void {
    const params = new URLSearchParams();
    if (listId !== null)
        params.set("list", String(listId));
    const qs = params.toString();
    window.history.replaceState(null, "", `${PATH}${qs ? `?${qs}` : ""}`);
}
export default function ExtShareScreen() {
    const [lists, setLists] = useState<ExtShareList[] | null>(null);
    const [listId, setListId] = useState<number | null>(listFromUrl);
    const [pass, setPass] = useState("");
    const [typed, setTyped] = useState("");
    const [games, setGames] = useState<ExtShareGame[] | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [guide, setGuide] = useState(false);
    const memberOf = useCallback(() => undefined, []);
    useEffect(() => forceLightTheme(), []);
    useEffect(() => {
        document.title = TITLE;
        setUrlList(listFromUrl());
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
        setUrlList(id);
    };
    const open = openId === null ? null : games?.find((g) => g.id === openId) ?? null;
    return (<div className="scr-app scr-app-fallback-scroll scr-extshare" id="scr-app">
      <div className="scr-bg-grid"/>
      <div id="scroll-root">
        <main className="scr-main scr-extshare-main">
          
          <header className="scr-crumb">
            {(listId !== null || open) && (<button type="button" className="scr-crumb-back" onClick={() => (open ? setOpenId(null) : goList(null))}>
                <ArrowLeft size={16}/>
                <span>{open ? "목록" : "전체 목록"}</span>
              </button>)}

            <h1 className="scr-crumb-title">
              {open ? gameTitleOf(open) : current?.name ?? (<>
                {TITLE}
                <span className="scr-crumb-subtitle">{SUBTITLE}</span>
              </>)}
            </h1>
            
            {listId !== null && (<button type="button" className="scr-crumb-guide" onClick={() => setGuide(true)}>
                <BookOpen size={13}/>
                <span>사용법</span>
              </button>)}
          </header>

          
          {listId === null && (lists === null ? <LoadingMark /> : (<div className="scr-extshare-lists">
                {lists.length === 0 && (<p className="scr-extshare-empty">아직 공개된 재생 목록이 없습니다.</p>)}
                {lists.map((l) => (<button type="button" key={l.id} className="scr-extshare-listcard" onClick={() => goList(l.id)}>
                    <span className="scr-extshare-listname">{l.name}</span>
                    <span className="scr-extshare-listmeta">
                      {l.locked && <Lock size={12} aria-label="비밀번호"/>}
                      {l.gameCount}판
                    </span>
                  </button>))}
              </div>))}

          
          {listId !== null && current?.locked && !pass && (<form className="scr-extshare-gate" onSubmit={(e) => { e.preventDefault(); void submitPass(); }}>
              <Lock size={22}/>
              <p>이 목록은 비밀번호가 필요합니다.</p>
              <input type="password" value={typed} autoFocus onChange={(e) => setTyped(e.target.value)} placeholder="비밀번호"/>
              <button type="submit" disabled={busy || !typed}>
                {busy ? <Spinner size={14}/> : "들어가기"}
              </button>
              {err && <span className="scr-extshare-err">{err}</span>}
            </form>)}

          
          {listId !== null && !open && (current ? !current.locked || !!pass : false) && (games === null ? <LoadingMark /> : (<div className="scr-extshare-games">
                {games.length === 0 && (<p className="scr-extshare-empty">이 목록에는 아직 경기가 없습니다.</p>)}
                {games.map((g) => {
                const mins = g.durationSeconds != null
                    ? Math.round(g.durationSeconds / 60) : null;
                return (<button type="button" key={g.id} className="scr-extshare-game" onClick={() => setOpenId(g.id)}>
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

          
          {open && (<div className="scr-extshare-detail">
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
