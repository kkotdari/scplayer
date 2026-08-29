import type { ReplayMapGrid } from "scplay";

/* 참값 집계 한 사람 몫의 꼴 — 서버 응답을 담기만 한다. 원장은 stargayte의 statsMix인데,
   이 앱은 그 파일(재생기 소유)을 안 끌고 오려고 꼴만 베껴 둔다. */
export interface TruthMix {
    bProd: number;
    bDef: number;
    uBasic: number;
    uAdv: number;
    uCaster: number;
    uGround: number;
    uAir: number;
    worker5: number;
    btGround?: number;
    btGroundWon?: number;
    btAir?: number;
    btAirWon?: number;
    btMagic?: number;
    btMagicWon?: number;
    upGw: number;
    upGa: number;
    upAw: number;
    upAa: number;
    upSh: number;
    ups: Record<string, number>;
    upCounts: Record<string, number>;
    buildings: Record<string, number>;
    units: Record<string, number>;
    skills: Record<string, number>;
    skillsWon?: Record<string, number>;
    buildingSecs: Record<string, number>;
    unitSecs: Record<string, number>;
    skillSecs: Record<string, number>;
    coreSeconds: number | null;
    coreCmd: number;
    coreBuild: number;
    coreUnit: number;
}
export type BaseRace = "테란" | "프로토스" | "저그";
export type Race = "테란" | "프로토스" | "저그" | "랜덤";
export type GameOutcome = "team1" | "team2" | "draw" | "not_held";
export type GameType = "0101" | "0102";
export type MemberStatus = "pending" | "active" | "suspended" | "withdrawn";
export type MemberRole = "0202" | "0203";
export interface Member {
    id: string;
    nickname: string;
    battletag: string;
    insta: string;
    avatar: string | null;
    replayAliases: string[];
    roles: MemberRole[];
    status: MemberStatus;
    createdAt: string;
    updatedAt: string;
}
export interface SignupPayload {
    id: string;
    password: string;
    nickname: string;
    battletag: string;
    replayAliases: string[];
    insta: string;
    avatar: string | null;
}
export interface MemberCreatePayload {
    id: string;
    password: string;
    nickname: string;
    battletag: string;
    replayAliases?: string[];
    insta: string;
    avatar: string | null;
}
export type ReplayNameKind = "computer" | "unregistered";
export interface ReplayNameClassificationEntry {
    rawName: string;
    kind: ReplayNameKind;
}
export type ReplayNameMappingKind = "member" | "computer" | "unregistered" | "unresolved";
export interface ReplayNameMappingMember {
    id: string;
    nickname: string;
    battletag: string;
    avatar: string | null;
}
export interface ReplayNameMappingEntry {
    rawName: string;
    kind: ReplayNameMappingKind;
    member: ReplayNameMappingMember | null;
    lastSeen: string | null;
    hasMatches: boolean;
}
export interface GameResultSlot {
    memberId: string;
    race: Race | "";
    rawName?: string | null;
    /** 1.16 이하 리플레이의 개인색(#rrggbb) — 서버가 리플레이를 파싱해 실어 준다.
     *  재생기에 넘기면 참값에 색이 없는 옛 판도 여덟 색으로 갈린다(scplay MinimapMarker.color).
     *  안 오면 종전대로 참값 → 팀색 순이다. */
    color?: string | null;
    /** 관전자 슬롯인가 — 참이면 재생기가 그 사람을 통째로 안 그린다(scplay MinimapMarker.observer). */
    observer?: boolean | null;
    apm: number | null;
    eapm: number | null;
    cmdCount: number | null;
    effectiveCmdCount: number | null;
    buildCount: number | null;
}
export interface Replay {
    id: number;
    originalName: string;
    displayName: string;
    url: string;
}
export interface ReplayUpload {
    originalName: string;
    displayName: string;
    url: string;
}
export interface GameResultAuthor {
    id: string;
    nickname: string;
}
export interface ActivityCommentMention {
    memberId: string;
    nickname: string;
}
export interface ActivityCommentAuthor {
    memberId: string;
    nickname: string;
    avatar: string | null;
}
export interface RankingShiftEntry {
    memberId: string;
    nickname: string;
    from: number | null;
    to: number;
    fromPoints?: number | null;
    toPoints?: number | null;
}
export interface RankingShiftSection {
    matchType: GameType;
    shifts: RankingShiftEntry[];
}
export interface RankingShift {
    id: number;
    reason: "daily" | "seed";
    createdAt: string;
    matchIds: number[];
    sections: RankingShiftSection[];
}
export type ActivityTargetType = "gameResult" | "challenge" | "rankingShift" | "leagueMatch" | "schedule" | "notice";
export interface ActivityComment {
    id: number;
    targetType: ActivityTargetType;
    targetId: number;
    text: string;
    author: ActivityCommentAuthor;
    createdAt: string;
    updatedAt: string;
    canEdit: boolean;
    mentions: ActivityCommentMention[];
}
export interface GameResult {
    id: number;
    matchNo: string;
    date: string;
    team1: GameResultSlot[];
    team2: GameResultSlot[];
    result: GameOutcome;
    matchType: GameType;
    replay: Replay | null;
    createdBy: GameResultAuthor | null;
    mapName: string | null;
    gameStartedAt: string | null;
    durationSeconds: number | null;
    mapHash: string | null;
    viewCount?: number;
}
export type NewGameResult = Omit<GameResult, "id" | "matchNo" | "createdBy" | "replay" | "mapHash"> & {
    replay: ReplayUpload | null;
    mapData: ReplayMapGrid | null;
};
export interface GameResultPage {
    items: GameResult[];
    nextCursor: string | null;
    hasMore: boolean;
    total: number | null;
}
export interface MemberStats {
    plays: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    bests: number;
    lostBests?: number;
    avgApm: number | null;
    avgEapm: number | null;
    avgCmd: number | null;
    avgEcmd: number | null;
    avgBuild: number | null;
    truthMix: TruthMix | null;
    buildMix?: TruthMix | null;
    avgWorker5: number | null;
    mixPlays: number | null;
    mixSeconds: number | null;
    upPlays: number | null;
}
export interface MemberStatsEntry {
    memberId: string;
    overall: MemberStats;
    byRace: Record<BaseRace, MemberStats>;
    mostPlayedRace: Race | null;
    sortOrder: number | null;
    tieGroup: number | null;
    personScore: number | null;
    superiorCount: number | null;
    equalCount: number | null;
    inferiorCount: number | null;
    rankScore: number | null;
    mu: number | null;
    sigma: number | null;
    ratingGames: number | null;
    provisional: boolean | null;
}
export interface RatingHistoryResponse {
    deltas: Record<string, number>;
    mu: number | null;
    sigma: number | null;
    conservative: number | null;
    games: number;
    provisional: boolean;
}
export interface RivalryPair {
    a: string;
    b: string;
    aWins: number;
    bWins: number;
    draws: number;
}
export interface ClanBreakdownEntry {
    label: string;
    plays: number;
    ratio: number;
}
export interface GameResultStatsResponse {
    members: MemberStatsEntry[];
    clan: MemberStatsEntry;
    clanMaps: ClanBreakdownEntry[];
    clanFormats: ClanBreakdownEntry[];
}
export interface TeamRankEntry {
    memberIds: string[];
    plays: number;
    wins: number;
    losses: number;
    draws: number;
    points: number;
}
export interface TeamRankingResponse {
    teams: TeamRankEntry[];
}
export type ScreenKey = "activity" | "ladder" | "clan" | "members" | "leagues" | "minimaps" | "control" | "models" | "scraps" | "guide";
export const SCREEN_KEYS: ScreenKey[] = ["activity", "ladder", "clan", "members",
    "leagues", "minimaps", "control", "models", "scraps", "guide"];
export interface ExtShareList {
    id: number;
    name: string;
    gameCount: number;
    locked: boolean;
    password?: string;
    sortOrder?: number;
}
export type ExtShareGame = GameResult & {
    listId: number;
    sortOrder: number;
    /** 사람이 지은 제목 — 비면 화면이 선수 이름으로 짓는다(extShareGameTitle). */
    title: string;
    hasTracks: boolean;
};
export interface SceneScrap {
    id: number;
    title: string;
    subtitle: string;
    link: string;
    gameNo?: string | null;
    createdAt: string;
}
export type AppVersion = string;
export interface AppVersionStatus {
    activeVersion: AppVersion;
    noticeEnabled: boolean;
}
export interface AppVersionInfo {
    number: AppVersion;
    notes: string;
}
export type ChallengeMatchType = "0101" | "0102";
export type ChallengeTargetResponse = "pending" | "accepted" | "rejected" | "discarded";
export type ChallengeStatus = "pending" | "confirmed" | "done" | "discarded";
export type ChallengeSide = "creator" | "target";
export type ChallengeResult = "creator" | "target" | "draw" | "not_held";
export interface ChallengeTarget {
    memberId: string;
    nickname: string;
    battletag: string;
    avatar: string | null;
    response: ChallengeTargetResponse;
    responseMessage: string;
}
export interface ChallengeOwnMember {
    memberId: string;
    nickname: string;
    battletag: string;
    avatar: string | null;
}
export interface Challenge {
    id: number;
    matchType: ChallengeMatchType;
    message: string;
    scheduledAt: string | null;
    scheduledDate: string | null;
    scheduledTimeNote: string;
    status: ChallengeStatus;
    createdBy: {
        id: string;
        nickname: string;
        avatar: string | null;
    };
    targets: ChallengeTarget[];
    ownMembers: ChallengeOwnMember[];
    createdAt: string;
    updatedAt: string;
    discardedAt: string | null;
    canceledBy: {
        id: string;
        nickname: string;
        avatar: string | null;
    } | null;
    resultWinnerSide: ChallengeResult | null;
    backdropUrl: string | null;
    backdropShareUrl: string | null;
    backdropShareWidth: number | null;
    backdropShareHeight: number | null;
}
export interface ChallengeCreatePayload {
    scheduledDate?: string | null;
    scheduledTimeNote?: string;
    message?: string;
    targetMemberIds: string[];
    ownTeamMemberIds?: string[];
    backdrop?: string | null;
    backdropShare?: string | null;
}
export type PeriodPreset = "all" | "today" | "week" | "month" | "year" | "custom";
export type LeagueMode = "team" | "individual";
export type LeagueStatus = "setup" | "active" | "completed";
export type LeagueMatchSide = "a" | "b";
export interface LeagueRosterMember {
    memberId: string;
    nickname: string;
    battletag: string;
    avatar: string | null;
    position: number;
}
export interface LeagueTeam {
    id: number;
    label: string;
    roster: LeagueRosterMember[];
}
export interface LeagueMatchTeamRef {
    id: number;
    label: string;
}
export interface LeagueMatchSubstitution {
    teamId: number;
    rosterPosition: number;
    substituteMemberId: string;
    substituteNickname: string;
    note: string;
}
export interface LeagueMatch {
    id: number;
    round: number;
    slotInRound: number;
    teamA: LeagueMatchTeamRef | null;
    teamB: LeagueMatchTeamRef | null;
    isDead: boolean;
    scheduledAt: string | null;
    setsWonA: number | null;
    setsWonB: number | null;
    winnerTeamId: number | null;
    substitutions: LeagueMatchSubstitution[];
}
export interface League {
    id: number;
    name: string;
    mode: LeagueMode;
    bestOf: number;
    status: LeagueStatus;
    drawSize: number | null;
    plannedTeams: number | null;
    bracketLocked: boolean;
    teams: LeagueTeam[];
    matches: LeagueMatch[];
    createdAt: string;
}
export interface LeagueListItem {
    id: number;
    name: string;
    mode: LeagueMode;
    status: LeagueStatus;
    teamCount: number;
}
export interface LeagueCreatePayload {
    name: string;
    mode: LeagueMode;
    bestOf?: number;
}
export interface LeagueUpdatePayload {
    name?: string;
    bestOf?: number;
}
export interface MapCanon {
    id: number;
    name: string;
    matches?: number;
}
export interface MapCatalogEntry {
    hash: string;
    name: string | null;
    width: number;
    height: number;
    matches: number;
    canonId: number | null;
    hasTerrain?: boolean;
}
export interface MapCatalog {
    maps: MapCatalogEntry[];
    canons: MapCanon[];
}
export interface LeagueMatchMember {
    memberId: string;
    nickname: string;
}
export interface LeagueMatchTeam {
    label: string;
    members: LeagueMatchMember[];
}
export interface LeagueMatchActivity {
    id: number;
    leagueId: number;
    leagueName: string;
    roundName: string;
    teamA: LeagueMatchTeam | null;
    teamB: LeagueMatchTeam | null;
    scheduledAt: string | null;
    setsWonA: number | null;
    setsWonB: number | null;
    winnerSide: "a" | "b" | null;
    postedAt: string;
    updatedAt: string;
}
export interface ScheduleFile {
    name: string;
    url: string;
    size: number;
}
export interface ScheduleAttendee {
    memberId: string;
    nickname: string;
    avatar: string | null;
    response: "going" | "notGoing";
}
export interface Schedule {
    id: number;
    title: string;
    scheduledDate: string;
    scheduledTime: string | null;
    content: string;
    linkUrl: string;
    files: ScheduleFile[];
    attendees: ScheduleAttendee[];
    createdBy: {
        id: string;
        nickname: string;
        avatar: string | null;
    };
    createdAt: string;
    updatedAt: string;
}
export interface ScheduleWrite {
    title: string;
    scheduledDate: string;
    scheduledTime: string | null;
    content: string;
    linkUrl: string;
    files: (ScheduleFile | {
        name: string;
        data: string;
    })[];
}
export interface ActivityNotice {
    id: number;
    kind: string;
    payload: {
        reason?: RankingShift["reason"];
        matchIds?: number[];
        sections?: RankingShiftSection[];
    };
    createdAt: string;
}
export interface ActivityFeedItem {
    key: string;
    kind: "challenge" | "gameResultPost" | "leagueMatch" | "schedule" | "notice";
    challenge?: Challenge | null;
    gameResults: GameResult[];
    leagueMatch?: LeagueMatchActivity | null;
    schedule?: Schedule | null;
    notice?: ActivityNotice | null;
    comments: ActivityComment[];
}
export interface ActivityFeedPage {
    total: number;
    totalActivities: number;
    items: ActivityFeedItem[];
    nextCursor: string | null;
}
