import React, { useCallback, useContext, useMemo, useState, type MouseEvent, type PointerEvent } from "react";
import { formatWhen } from "../../utils/date";
import { ReplayModule, PLAYBACK_ZOOM_MAX, type MotionBase } from "scplay";
import { api } from "../../api/client";
import RosterSide, { isMeleeGame, outcomeFor, resolveSlotName } from "./GameResultSides";
import Avatar from "../../components/common/Avatar";
import SceneShareButton from "./SceneShareButton";
import { GameDetailCloseContext } from "./gameDetailClose";
import { useReplayMap } from "scplay";
import { cleanMapName } from "../../utils/mapName";
import { cx } from "../../utils/format";
import { normalizeSearchText } from "../../utils/memberSearch";
import type { GameResult, GameResultSlot, Member } from "../../types";
export default function GameResultStory({ gameResult, team1, team2, result, memberOf, highlightMemberIds, highlightTerms, active = true, menu, extShare = false, }: {
    gameResult: GameResult;
    team1: GameResultSlot[];
    team2: GameResultSlot[];
    result: GameResult["result"];
    memberOf: (id: string) => Member | undefined;
    highlightMemberIds?: Set<string>;
    highlightTerms?: string[];
    menu?: import("react").ReactNode;
    active?: boolean;
    extShare?: boolean;
}) {
    const grid = useReplayMap(gameResult.mapHash);
    const detailClose = useContext(GameDetailCloseContext);
    const linkQuery = useMemo(() => {
        const q = new URLSearchParams(window.location.search);
        /* 장면 쿼리는 경로가 가리키는 **열린 경기**의 것이다 — 이 화면은 한 번에 한
           판만 띄우므로 group/item 없이도 헷갈릴 데가 없다(지적: "쓸데없는 파라미터").
           옛 링크(group=gameResult&item=…)는 그대로 받되, 다른 판을 가리키면 버린다. */
        const gameParam = q.get("item");
        if (q.get("group") === "gameResult" || gameParam) {
            if (q.get("group") !== "gameResult" || !gameParam)
                return null;
            if (gameParam !== gameResult.matchNo && Number(gameParam) !== gameResult.id)
                return null;
            return q;
        }
        return ["t", "s", "z", "cx", "cy", "a", "tr"].some((k) => q.has(k)) ? q : null;
    }, []);
    const initialSec = useMemo(() => {
        const v = Number(linkQuery?.get("t"));
        return Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined;
    }, [linkQuery]);
    const initialSpeed = useMemo(() => {
        const v = Number(linkQuery?.get("s"));
        return Number.isFinite(v) && v > 1 ? v : undefined;
    }, [linkQuery]);
    const initialView = useMemo(() => {
        if (!linkQuery)
            return undefined;
        const num = (k: string, dflt: number): number => {
            const raw9 = linkQuery.get(k);
            if (raw9 === null || raw9.trim() === "")
                return dflt;
            const v = Number(raw9);
            return Number.isFinite(v) ? v : dflt;
        };
        if (linkQuery.get("z") === null && linkQuery.get("cx") === null
            && linkQuery.get("a") === null)
            return undefined;
        return {
            z: Math.min(PLAYBACK_ZOOM_MAX, Math.max(1, num("z", 1))),
            cx: Math.min(1, Math.max(0, num("cx", 0.5))),
            cy: Math.min(1, Math.max(0, num("cy", 0.5))),
            deg: num("a", 90),
        };
    }, [linkQuery]);
    const stampText = formatWhen(gameResult.gameStartedAt ?? gameResult.date, { clock: true });
    const slots = useMemo(() => {
        const all = [...team1, ...team2];
        const rows: {
            raw: string;
            name: string;
            slot: GameResultSlot;
            team: 1 | 2;
        }[] = [];
        const add = (list: GameResultSlot[], team: 1 | 2) => {
            list.forEach((slot) => {
                const name = resolveSlotName(slot, all, memberOf);
                if (slot.rawName)
                    rows.push({ raw: slot.rawName, name, slot, team });
            });
        };
        add(team1, 1);
        add(team2, 2);
        return rows;
    }, [team1, team2, memberOf]);
    const initialTrack = useMemo(() => {
        const raw9 = linkQuery?.get("tr");
        if (!raw9)
            return undefined;
        return slots.some((s9) => s9.raw === raw9) ? raw9 : undefined;
    }, [linkQuery, slots]);
    const bases: MotionBase[] = useMemo(() => slots.map((s) => {
        const nameLc = normalizeSearchText(s.name);
        const hit = highlightMemberIds?.has(s.slot.memberId)
            || !!highlightTerms?.some((t) => nameLc.includes(t));
        return {
            key: s.raw, name: s.name, memberId: s.slot.memberId,
            avatar: memberOf(s.slot.memberId)?.avatar ?? null,
            race: s.slot.race, team: s.team,
            // 개인색과 관전자는 재생기가 아는 길이 없다 — 리플레이를 파싱한 쪽만 안다.
            // 없으면 undefined로 둔다(빈 값을 넘기면 종전 규칙을 덮어쓴다).
            color: s.slot.color ?? undefined,
            observer: s.slot.observer ?? undefined,
            withName: true, highlight: hit,
            apm: s.slot.apm,
        };
    }), [slots, memberOf, highlightMemberIds, highlightTerms]);
    // 관전자는 판을 안 든다 — 이 앱이 그리는 로스터·승패 이름·난전 판정은 걸러 낸
    // 목록으로 센다(관전자가 끼면 1대1이 2대1로 세어져 이름 대신 "1팀 승"이 나온다).
    // 재생기에 넘기는 bases는 그대로 둔다 — observer 칸을 보고 저쪽이 통째로 숨긴다.
    const t1 = useMemo(() => team1.filter((s) => !s.observer), [team1]);
    const t2 = useMemo(() => team2.filter((s) => !s.observer), [team2]);
    const o1 = outcomeFor("team1", result);
    const o2 = outcomeFor("team2", result);
    const winLabel = (() => {
        if (result === "draw")
            return "무승부";
        const side = o1 === "win" ? t1 : t2;
        if (isMeleeGame({ matchType: gameResult.matchType, team1: t1, team2: t2 })
            || (t1.length === 1 && t2.length === 1)) {
            return `${resolveSlotName(side[0], [...t1, ...t2], memberOf)} 승`;
        }
        return `${o1 === "win" ? 1 : 2}팀 승`;
    })();
    const mapName = cleanMapName(gameResult.mapName);
    const minutes = gameResult.durationSeconds != null
        ? Math.round(gameResult.durationSeconds / 60) : null;
    const melee = isMeleeGame({ matchType: gameResult.matchType, team1: t1, team2: t2 });
    const storyMap = grid ?? null;
    const showRoster = grid === null;
    const [revealWin, setRevealWin] = useState(false);
    const soleViewNow = extShare || !!detailClose || linkQuery !== null;
    const showMapLine = showRoster && Boolean(mapName || minutes !== null);
    const stopBubble = {
        onPointerDown: (e: PointerEvent) => e.stopPropagation(),
        onMouseDown: (e: MouseEvent) => e.stopPropagation(),
        onClick: (e: MouseEvent) => e.stopPropagation(),
    };
    const vsRow = (<span className="scr-challenge-arrow-row">
      <span className={cx("scr-challenge-inline-win", o1 === "draw" && "scr-challenge-inline-draw", o1 !== "win" && o1 !== "draw" && "scr-challenge-inline-win-hidden")}>
        {o1 === "draw" ? "무" : "승"}
      </span>
      <span className="scr-challenge-arrow scr-challenge-arrow-vs" aria-hidden="true">vs</span>
      <span className={cx("scr-challenge-inline-win", o2 === "draw" && "scr-challenge-inline-draw", o2 !== "win" && o2 !== "draw" && "scr-challenge-inline-win-hidden")}>
        {o2 === "draw" ? "무" : "승"}
      </span>
    </span>);
    const endSecVal = gameResult.durationSeconds ?? null;
    const teamByRaw = useMemo(() => {
        const m = new Map<string, 1 | 2>();
        for (const x of slots)
            if (x.team)
                m.set(x.raw, x.team);
        return m;
    }, [slots]);
    const teamOfRaw = useCallback((raw: string): 1 | 2 | undefined => teamByRaw.get(raw), [teamByRaw]);
    // 재생 상자(scr-story-map)는 ReplayModule이 제 몸으로 두른다 — 여기서 또 두르면 두 겹이다.
    const mapBlock = storyMap && (<div className="scr-story-player" {...stopBubble}>
      
      {/* 머리 한 줄과 재생기는 scplay의 ReplayModule 한 벌이다 — 승패 배지의 양쪽 세우기·
          가림(veil) 규약이 그 안에 있다. 이 앱은 무엇을 적을지만 넘긴다. */}
      <ReplayModule
        grid={storyMap} endSec={endSecVal}
        bases={bases} teamOfRaw={teamOfRaw} active={active}
        head={{
          stamp: stampText,
          mapName,
          minutes,
          win: !showRoster && result !== "not_held"
            ? {
              side: result === "draw" ? "draw" : o1 === "win" ? 1 : 2,
              label: winLabel,
              veiled: !revealWin,
            }
            : null,
          by: gameResult.createdBy ? (
            <>
              <Avatar
                member={{
                  id: gameResult.createdBy.id,
                  nickname: gameResult.createdBy.nickname,
                  avatar: memberOf(gameResult.createdBy.id)?.avatar ?? null,
                }}
                size={16}
              />
              <span>{gameResult.createdBy.nickname} 등록</span>
            </>
          ) : null,
        }}
        avatars={false}
        initialSec={initialSec} initialSpeed={initialSpeed}
        initialView={initialView} initialTrack={initialTrack}
        clockKey={String(gameResult.matchNo || gameResult.id)}
        shareNode={(
          <SceneShareButton
            clockKey={String(gameResult.matchNo || gameResult.id)}
            title={`${mapName || "경기"} 장면`}
          />
        )}
        onDetailClose={detailClose ?? undefined}
        soleView={soleViewNow}
        loadUnitTracks={() => api.getGameUnitTracks(gameResult.id)
          .catch(() => ({ motion: null }))}
        winnerTeam={gameResult.result === "team1" ? 1 : gameResult.result === "team2" ? 2 : undefined}
        melee={isMeleeGame({ matchType: gameResult.matchType, team1: t1, team2: t2 })}
        onFinish={soleViewNow ? () => setRevealWin(true) : undefined}
        menu={menu}
      />
    </div>);
    return (<div className="scr-story">
      {showRoster && (melee ? (<div className={cx("scr-roster-matchup", "scr-roster-matchup-melee", "scr-activity-game-result-matchup", grid && "scr-story-matchup-wide")}>
            {[...t1, ...t2].map((s9, i9) => (<React.Fragment key={`${s9.memberId}-${i9}`}>
                {i9 > 0 && <span className="scr-story-melee-vs" aria-hidden>vs</span>}
                <div className="scr-roster-melee-one">
                  <RosterSide team={[s9]} memberOf={memberOf} highlightMemberIds={highlightMemberIds} highlightTerms={highlightTerms}/>
                  
                  {result !== "not_held" && result !== "draw"
                    && t1.some((w9) => w9.memberId === s9.memberId) && (<span className="scr-story-win scr-story-win-t1">승</span>)}
                </div>
              </React.Fragment>))}
          </div>) : (<div className={cx("scr-roster-matchup", "scr-activity-game-result-matchup", grid && "scr-story-matchup-wide")}>
          <RosterSide team={t1} memberOf={memberOf} highlightMemberIds={highlightMemberIds} highlightTerms={highlightTerms}/>
          
          <div className="scr-story-mid">
            {vsRow}
          </div>
          <RosterSide team={t2} memberOf={memberOf} highlightMemberIds={highlightMemberIds} highlightTerms={highlightTerms}/>
        </div>))}
      {result === "not_held" && <div className="scr-activity-game-result-notheld">미실시</div>}
      {!showRoster && mapBlock}
      
      {showMapLine && (<div className="scr-game-result-trow-map-line scr-game-result-trow-map-meta">
          {mapName && <span className="scr-game-result-trow-map">{mapName}</span>}
          {minutes !== null && <span className="scr-game-result-trow-dur">({minutes}분)</span>}
        </div>)}
      
      
      {gameResult.createdBy && (<div className="scr-story-by">{gameResult.createdBy.nickname} 등록</div>)}
    </div>);
}
