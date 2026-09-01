import type { GameResultSlot } from "../types";

/** 이 판이 **개인전(FFA)**인가 — 편이 없어 모두가 서로의 적인 판.
 *
 *  `0101`은 원래 1대1을 뜻하는 갈래인데, 사람이 셋 이상이면 그것은 '편 없는 난전'이다.
 *  둘 이하이면 그냥 1대1이라 편으로 묶어도 같은 말이 된다.
 *  ★ 여기가 **유일한 정의**다 — 화면(GameResultSides)과 제목(lineupTitle)이 이 하나를
 *    같이 본다. 둘로 두면 반드시 갈리고, 그 갈림이 곧 '화면은 팀전인데 제목은 난전'이다. */
export function isMeleeGame(g: {
  matchType?: string | null;
  team1: GameResultSlot[];
  team2: GameResultSlot[];
}): boolean {
  return g.matchType === "0101" && g.team1.length + g.team2.length > 2;
}

/** 판을 부르는 이름 — 선수 이름으로 짓는다(사람이 지은 제목이 있으면 부르는 쪽이 먼저 쓴다).
 *
 *  ★ **편이 있으면 편으로 묶는다**(지적: "팀 vs 팀이 아니라 전체 vs로 나오는 문제") ────
 *    여태 team1·team2를 통째로 합쳐 모두를 " vs "로 이었다. 그러면 3대3이
 *    "A vs B vs C vs D vs E vs F"가 되어 **여섯이 저마다 싸운 난전**으로 읽힌다.
 *    실제로 그런 판(개인전)도 있으니 " vs "로 잇는 것 자체가 틀린 것은 아니고, 두 가지를
 *    **가르지 않은 것**이 틀렸다. 편이 있는 판은 편 안을 쉼표로 묶고 편끼리만 vs로 잇는다.
 *  ★ 관전자는 안 센다 — 판을 든 사람만 이름에 오른다. */
export function lineupTitle(g: {
  matchType?: string | null;
  team1: GameResultSlot[];
  team2: GameResultSlot[];
}, nameOf: (s: GameResultSlot) => string): string {
  const n1 = g.team1.filter((s) => !s.observer).map(nameOf).filter(Boolean);
  const n2 = g.team2.filter((s) => !s.observer).map(nameOf).filter(Boolean);
  if (n1.length + n2.length === 0) return "";
  /* 개인전은 편이 없다 — 편으로 묶으면 없는 편을 지어내는 셈이다.
     ★ 판정에는 **거르지 않은** 편을 그대로 넘긴다 — 화면(GameResultSides)이 보는 것과
       같은 수여야 제목과 화면이 같은 판을 같은 말로 부른다. */
  if (isMeleeGame(g)) return [...n1, ...n2].join(" vs ");
  return [n1.join(", "), n2.join(", ")].filter(Boolean).join(" vs ");
}
