type ClassValue = string | false | null | undefined;
export const cx = (...a: ClassValue[]): string => a.filter(Boolean).join(" ");
export function hashStr(str: string): number {
    let h = 0;
    for (const c of String(str))
        h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
}
export const AVATAR_PALETTE = [
    "#5865f2", "#eb459e", "#3ba55c", "#f2994a", "#4c8bf5",
];
export const avatarColor = (id: string): string => AVATAR_PALETTE[hashStr(id) % AVATAR_PALETTE.length];
