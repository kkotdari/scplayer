import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Play, X } from "lucide-react";
import {
    SHAPE_GALLERY, ShapeIcon, poseCutsOf, poseTempoOf, atkCutOf, flapCutOf,
    type ShapeGalleryItem,
} from "scplay";

/* 도록(모델 자료실) — 재생기가 쓰는 모델을 한 자리에서 본다(요청).
 *
 * ■ 이 화면이 짓지 않는 것
 * 모델을 그리는 일은 한 톨도 안 짓는다. scplay가 낸 넷이 그 일을 다 한다 —
 * SHAPE_GALLERY(무엇이 있나) · ShapeIcon(한 컷을 그린다) · poseCutsOf/poseTempoOf
 * (어떤 컷을 어떤 박자로) · atkCutOf/flapCutOf(지금 어느 컷인가). 여기서 짓는 것은
 * 고르기·배치·팝업뿐이다.
 * 그래서 모델을 고치면 이 화면이 **저절로 따라온다** — 목록도 차례도 저쪽 표가 정한다.
 *
 * ■ 차례
 * SHAPE_GALLERY의 차례를 그대로 쓴다(요청: "원작에서 먼저 등장하는 유닛/건물 순").
 * 그 표가 이미 유닛/건물로 가르고 테란 → 프로토스 → 저그, 그 안에서 기본 → 고급·후반이다.
 */

/** ★ 개인색은 **못 바꾼다**(요청: "개인 색은 에메랄드 연두 네온색. 변경 불가") ─────────
 *  칠하지 않은 면이 곧 개인색 자리다(scplay의 규약 — ShapeIcon은 그 면을 currentColor로
 *  채운다). 도록은 임자가 없는 화면이라 색을 고를 까닭이 없고, 무엇보다 **같은 색으로
 *  견줘야** 모델끼리의 차이가 색이 아니라 꼴로 읽힌다. 손잡이를 안 만든다. */
const OWN_COLOR = "#3ff2a0";

type Group = ShapeGalleryItem["group"];
type RacePick = "전체" | "테란" | "프로토스" | "저그";

/** 각도 칸 — PC는 0도부터 45도씩 여덟 방, 좁은 화면은 네 방이다(요청).
 *  네 방을 45·135·225·315로 잡는 것도 요청이다: 0/90/180/270은 정면·측면이라 서로
 *  가장 안 갈리는 넷이고, 45도씩 비낀 넷이 앞뒤·좌우를 한 번에 보여 준다. */
const ROTS_WIDE = [0, 45, 90, 135, 180, 225, 270, 315];
const ROTS_NARROW = [45, 135, 225, 315];

/** 모션 팝업의 시점 칸 — 자유 요잉에 피치 세 칸(평면·사선·입체)을 곁들인다.
 *  scplay의 투영은 사선(oblique)이라 피치가 이 세 칸이고 롤은 없다 — 요잉만 자유각이다. */
const PITCHES = [
    { key: "flat", label: "평면", flat: true, pitchView: false },
    { key: "obl", label: "사선", flat: false, pitchView: false },
    { key: "iso", label: "입체", flat: false, pitchView: true },
] as const;

/** 지금 화면이 넓은가 — 각도 칸 수가 이 값으로 갈린다(레이아웃만이 아니라 **그리는 수**가
 *  달라지므로 CSS가 아니라 여기서 가른다). */
function useWide(): boolean {
    const [wide, setWide] = useState(() =>
        typeof window === "undefined" ? true : window.matchMedia("(min-width: 900px)").matches);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia)
            return undefined;
        const mq = window.matchMedia("(min-width: 900px)");
        const read = (): void => setWide(mq.matches);
        read();
        mq.addEventListener("change", read);
        return () => mq.removeEventListener("change", read);
    }, []);
    return wide;
}

/** ★ 화면에 든 자리만 굽는다(계측: 안 그러면 첫 그림까지 **55.8초**) ────────────────
 *  도록 한 페이지는 유닛 53종 × 각도 8칸 = **424장**이다. ShapeIcon 한 장은 모델을
 *  실제로 굽는 일이라(면 수백 장을 짜고 투영한다) 장당 130ms쯤 든다 — 리액트가 그걸
 *  한 번에 다 그리므로 첫 화면이 1분 가까이 안 뜬다. 어느 기기에서도 못 쓴다.
 *  그래서 항목마다 **제 자리가 화면 가까이 올 때** 각도 칸을 짓는다. 이름 줄은 늘
 *  그리므로 목록·차례·고르기는 처음부터 다 보이고, 굽는 것만 미룬다. 한 번 뜬 자리는
 *  다시 안 접는다(스크롤을 되돌릴 때마다 다시 굽는 것이 더 나쁘다).
 *  여유(rootMargin)를 한 화면 넉넉히 두어, 굽는 동안이 스크롤보다 앞선다. */
function useNear<T extends Element>(): [React.RefObject<T>, boolean] {
    const ref = useRef<T>(null);
    const [near, setNear] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || near)
            return undefined;
        if (typeof IntersectionObserver === "undefined") {
            setNear(true);
            return undefined;
        }
        const io = new IntersectionObserver((es) => {
            if (es.some((e) => e.isIntersecting))
                setNear(true);
        }, { rootMargin: "600px 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, [near]);
    return [ref, near];
}

/** 흐르는 시각(초) — 모션 팝업이 열려 있는 동안만 돈다(닫히면 프레임을 안 먹는다). */
function useClock(on: boolean): number {
    const [t, setT] = useState(0);
    useEffect(() => {
        if (!on)
            return undefined;
        let raf = 0;
        const t0 = performance.now();
        const step = (): void => {
            setT((performance.now() - t0) / 1000);
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [on]);
    return t;
}

/** 그 종류의 세 모션 — 없는 컷은 idle로 갈음한다(요청).
 *  돌려주는 것은 **컷 번호**다: 0 기본 · 1·3 걸음 · 2·4·5 공격. */
function cutsAt(kind: string, t: number): { idle: 0 | 1 | 2 | 3 | 4 | 5; move: 0 | 1 | 2 | 3 | 4 | 5; act: 0 | 1 | 2 | 3 | 4 | 5 } {
    const pk = poseCutsOf(kind);
    const tempo = poseTempoOf(kind);
    /* idle — 나는 몸은 서 있어도 날개를 친다(그것이 그 몸의 '가만히'다). 나머지는 0. */
    const idle = pk?.flap ? flapCutOf(pk.flap, t) : 0;
    /* 이동 — 걸음 컷은 1과 3을 오간다. 박자는 그 종류의 걸음 Hz다.
       ★ 걸음 컷이 없으면 idle 그대로다(요청). */
    const move = pk?.move && tempo
        ? (Math.floor(t * tempo.walkHz) % 2 === 1 ? 3 : 1) as 1 | 3
        : idle;
    /* 액션 — 재생기와 **같은 문**(atkCutOf)이 컷을 낸다. 쿨다운 한 바퀴가 위상이다. */
    const act = pk?.atk && tempo
        ? atkCutOf(kind, ((t % tempo.atkCd) + tempo.atkCd) % tempo.atkCd / tempo.atkCd, pk.flap, t)
        : idle;
    return { idle, move, act };
}

/** 모션 팝업 — idle·이동·액션 셋을 나란히(PC 가로 · 모바일 세로, 요청).
 *  요잉은 드래그로 자유롭게 돌린다(각도 제한 없음). 피치는 세 칸을 버튼으로 고른다. */
function MotionPopup({ item, onClose }: { item: ShapeGalleryItem; onClose: () => void }) {
    const wide = useWide();
    const t = useClock(true);
    const [yaw, setYaw] = useState(45);
    const [pitch, setPitch] = useState(1);
    const drag = useRef<{ x: number; yaw: number } | null>(null);
    const cuts = cutsAt(item.kind, t);
    const pk = poseCutsOf(item.kind);
    const view = PITCHES[pitch];
    /* 자유 요잉 — 드래그한 픽셀을 그대로 도로 바꾼다(0.6도/px). 각을 안 죈다:
       요청이 "각도 제한 없이"이고, ShapeIcon은 어느 각이든 22.5도 칸으로 갈무리해 굽는다. */
    const onDown = (e: React.PointerEvent): void => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, yaw };
    };
    const onMove = (e: React.PointerEvent): void => {
        if (!drag.current)
            return;
        setYaw(drag.current.yaw + (e.clientX - drag.current.x) * 0.6);
    };
    const onUp = (): void => { drag.current = null; };
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    const cells: { label: string; cut: 0 | 1 | 2 | 3 | 4 | 5; own: boolean }[] = [
        { label: "대기", cut: cuts.idle, own: true },
        { label: "이동", cut: cuts.move, own: !!pk?.move },
        { label: "액션", cut: cuts.act, own: !!pk?.atk },
    ];
    return (
        <div className="scr-doc-pop" role="dialog" aria-modal="true" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="scr-doc-popbox" style={{ color: OWN_COLOR }}>
            <header className="scr-doc-pophead">
              <h3>{item.label}</h3>
              <div className="scr-doc-popview">
                {PITCHES.map((p, i) => (
                  <button type="button" key={p.key} className={i === pitch ? "is-on" : ""} onClick={() => setPitch(i)}>
                    {p.label}
                  </button>
                ))}
                <button type="button" className="scr-doc-popclose" onClick={onClose} aria-label="닫기"><X size={16} /></button>
              </div>
            </header>
            <div
              className={`scr-doc-popstage${wide ? "" : " is-tall"}`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {cells.map((c) => (
                <figure key={c.label} className="scr-doc-popcell">
                  <ShapeIcon
                    kind={item.kind}
                    rotDeg={yaw}
                    pose={c.cut}
                    flat={view.flat}
                    pitchView={view.pitchView}
                    fit
                    className="scr-doc-svg"
                  />
                  <figcaption>
                    {c.label}
                    {!c.own && <span className="scr-doc-same">모델 없음 · 대기와 같음</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="scr-doc-pophint">좌우로 끌면 돌아갑니다</p>
          </div>
        </div>
    );
}

/* ★ 창은 **잉크에 맞춘다**(fit) — 못 박은 32-상자를 썼다가 눈으로 보고 되돌린 자리다.
   32-상자는 지도가 쓰는 넓은 창이라, 그 안에서 마린의 잉크는 상자의 6분의 1이다:
   칸에 그리면 **점 하나**가 되어 무엇인지 안 보였다(첫 판 스크린샷이 그랬다).
   도록은 '어떻게 생겼나'를 보는 자리이므로 칸을 꽉 채우는 편이 옳다.
   ※ 대신 컷이 바뀌면 실루엣과 함께 창도 조금 달라진다(scplay의 fitBox 주석이 적어 둔
     그 사고다). 정지 그림인 각도 줄에서는 칸마다 제 그림이라 뜻이 없고, 모션 팝업에서는
     자세가 갈릴 때 크기가 살짝 흔들린다 — 안 보이는 것보다 낫다는 판단이고, 거슬리면
     부르는 쪽이 창을 재서 못 박을 자리(fitBox)가 이미 열려 있다. */

/** 한 항목 — 이름 줄과 각도 칸. 각도 칸은 자리가 화면 가까이 올 때 짓는다(위 useNear). */
function GalleryRow({ item, rots, wide, onMotion }: {
    item: ShapeGalleryItem; rots: number[]; wide: boolean; onMotion: () => void;
}) {
    const [ref, near] = useNear<HTMLElement>();
    return (
        <section ref={ref} className="scr-doc-item">
          <header className="scr-doc-itemhead">
            <h3>{item.label}</h3>
            {item.race && <span className="scr-doc-race">{item.race}</span>}
            <button type="button" className="scr-doc-motion" onClick={onMotion}>
              <Play size={12} />
              <span>모션 보기</span>
            </button>
          </header>
          <div className={`scr-doc-angles${wide ? "" : " is-narrow"}`}>
            {rots.map((deg) => (
              <div key={deg} className="scr-doc-angle">
                {near
                  ? <ShapeIcon kind={item.kind} rotDeg={deg} fit className="scr-doc-svg" />
                  /* 아직 안 구운 자리 — 다 구운 칸과 **같은 높이**를 차지해야 스크롤이
                     안 튄다(자리가 갑자기 늘면 보던 곳이 밀린다). */
                  : <div className="scr-doc-svg scr-doc-hold" aria-hidden />}
                <span>{deg}°</span>
              </div>
            ))}
          </div>
        </section>
    );
}

/** 갈래 고르기 — 유닛·건물이 본 페이지이고, 그 밖은 **따로 한 페이지**다(요청).
 *  한 화면 안의 칸이지만 목록이 통째로 갈리고 종족 고르기도 새로 서므로, 사람에게는
 *  다른 페이지다. 주소에도 제 값이 실린다(?doc=aux). */
const GROUPS: { key: Group; label: string }[] = [
    { key: "유닛", label: "유닛" },
    { key: "건물", label: "건물" },
    { key: "부가", label: "그 밖의 모델" },
];

export default function GalleryScreen({ group, onGroup, onClose }: {
    group: Group; onGroup: (g: Group) => void; onClose: () => void;
}) {
    const wide = useWide();
    const [race, setRace] = useState<RacePick>("전체");
    const [open, setOpen] = useState<ShapeGalleryItem | null>(null);
    const rots = wide ? ROTS_WIDE : ROTS_NARROW;
    const rows = useMemo(
        () => SHAPE_GALLERY.filter((g) => g.group === group && (race === "전체" || g.race === race)),
        [group, race],
    );
    /* 갈래를 갈아타면 종족 고르기를 되돌린다 — '부가'에는 프로토스가 하나뿐이라, 고른
       종족을 들고 넘어가면 빈 화면이 나온다. */
    useEffect(() => { setRace("전체"); }, [group]);
    return (
        <div className="scr-doc">
          <div className="scr-doc-picks">
            <div className="scr-doc-pickrow" role="group" aria-label="갈래">
              {GROUPS.map((g) => (
                <button type="button" key={g.key} className={g.key === group ? "is-on" : ""} onClick={() => onGroup(g.key)}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="scr-doc-pickrow is-race" role="group" aria-label="종족">
              {(["전체", "테란", "프로토스", "저그"] as RacePick[]).map((r) => (
                <button type="button" key={r} className={r === race ? "is-on" : ""} onClick={() => setRace(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 && <p className="scr-doc-empty">해당하는 모델이 없습니다.</p>}
          <div className="scr-doc-list" style={{ color: OWN_COLOR }}>
            {rows.map((it) => (
              <GalleryRow key={it.kind} item={it} rots={rots} wide={wide} onMotion={() => setOpen(it)} />
            ))}
          </div>
          {open && <MotionPopup item={open} onClose={() => setOpen(null)} />}
          <button type="button" className="scr-doc-back" onClick={onClose}>
            <ArrowLeft size={16} /><span>돌아가기</span>
          </button>
        </div>
    );
}
