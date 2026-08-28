import type { ExtShareGame, ExtShareList } from "../types";
import type { ReplayMapGrid } from "scplay";

// 백엔드는 스타게이트와 같은 서버다 — 이 앱은 그중 공개(public)·제한(restricted) 문만 쓴다.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

// 목록 비밀번호 한 겹 — 로그인이 없는 대신, 맵 격자·참값 자취 요청마다 이 값을 대조한다.
// 재생기 깊숙한 자리(useReplayMap·loadUnitTracks)가 부르므로 인자 대신 모듈 상태로 든다.
let extShareCtx: { listId: number; pass: string } | null = null;
export function setExtShareContext(ctx: { listId: number; pass: string } | null): void {
  extShareCtx = ctx;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (extShareCtx) headers.set("X-Ext-Pass", extShareCtx.pass);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = (body as { detail?: string } | null)?.detail;
    throw new Error(typeof detail === "string" ? detail : `요청이 실패했습니다 (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  /** 접속 기록 — 로그인 없는 방문도 어느 공개 화면에 왔는지는 남긴다. 실패는 조용히. */
  async pingPublicAccess(screen: string, detail?: string): Promise<void> {
    try {
      await request<void>("/api/public/access-ping", {
        method: "POST", body: JSON.stringify({ screen, detail: detail ?? null }),
      });
    } catch { /* 기록 하나 때문에 화면이 흔들리면 안 된다 */ }
  },

  /** 문 앞 — 이름·판 수·잠김 여부뿐이다(비밀번호는 서버가 안 내보낸다). */
  async getExtShareLists(): Promise<ExtShareList[]> {
    return request<ExtShareList[]>("/api/public/share/lists");
  },

  /** 비밀번호 확인 — 틀리면 서버가 403이라 예외로 온다. 안 잠긴 목록은 빈 글자로 통과다. */
  async enterExtShare(listId: number, password: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/restricted/share/lists/${listId}/enter`, {
      method: "POST", body: JSON.stringify({ password }),
    });
  },

  /** 그 목록의 경기들 — 알맹이는 GameResult 그 꼴이다(서버가 payload를 그대로 낸다). */
  async getExtShareGames(listId: number, password: string): Promise<ExtShareGame[]> {
    const res = await request<{ items: ExtShareGame[] }>(
      `/api/restricted/share/lists/${listId}/games`, { headers: { "X-Ext-Pass": password } },
    );
    return res.items;
  },

  /** 참값 자취 — 서버가 리플레이를 실제로 돌려 구운 것. 아직 안 구웠으면 null이다. */
  async getGameUnitTracks(id: number): Promise<{ motion: string | null }> {
    if (!extShareCtx) return { motion: null };
    const res = await request<{ motion?: string | null }>(
      `/api/restricted/share/lists/${extShareCtx.listId}/games/${id}/unit-tracks`,
    );
    return { motion: res.motion ?? null };
  },

  /** 맵 격자(지형 포함) — 재생기가 지도를 그리는 재료다. */
  async getReplayMaps(hashes: string[]): Promise<ReplayMapGrid[]> {
    if (hashes.length === 0 || !extShareCtx) return [];
    const qs = new URLSearchParams({ hashes: hashes.join(",") }).toString();
    const res = await request<{ maps: ReplayMapGrid[] }>(
      `/api/restricted/share/lists/${extShareCtx.listId}/maps?${qs}`,
    );
    return res.maps;
  },
};
