import type { User } from "./types";

// ── Registered user ─────────────────────────────────────────────────────────

export function saveAuth(token: string, user: User) {
  localStorage.setItem("qrio_token", token);
  localStorage.setItem("qrio_user", JSON.stringify(user));
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("qrio_user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("qrio_token");
}

export function clearAuth() {
  localStorage.removeItem("qrio_token");
  localStorage.removeItem("qrio_user");
}

// ── Guest (no account) ───────────────────────────────────────────────────────

export function saveGuest(name: string) {
  sessionStorage.setItem("qrio_guest", name);
}

export function getGuestName(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("qrio_guest") || null;
}

export function clearGuest() {
  sessionStorage.removeItem("qrio_guest");
}

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Returns the display username for whichever session type is active. */
export function getUsername(): string {
  return getUser()?.username || getGuestName() || "";
}

/** True when the visitor has ANY valid identity (registered or guest). */
export function hasUser(): boolean {
  if (typeof window === "undefined") return false;
  return isLoggedIn() || !!getGuestName();
}

/** Where to send the user after a game or when they hit "Home". */
export function getHomePath(): string {
  return isLoggedIn() ? "/dashboard" : "/";
}

// ── Guest game quota ─────────────────────────────────────────────────────────
// Guests get a small free trial before being asked to register. Stored in
// localStorage (not sessionStorage) so it persists across tabs and reloads —
// the whole point is to remember across visits.

const GUEST_GAMES_KEY = "qrio_guest_games_played";
export const GUEST_GAME_LIMIT = 2;

export function getGuestGamesPlayed(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(GUEST_GAMES_KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function incrementGuestGamesPlayed(): number {
  if (typeof window === "undefined") return 0;
  const next = getGuestGamesPlayed() + 1;
  try { localStorage.setItem(GUEST_GAMES_KEY, String(next)); } catch { /* ignore */ }
  return next;
}

export function resetGuestGamesPlayed() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(GUEST_GAMES_KEY); } catch { /* ignore */ }
}

/** True iff the visitor is a guest who has hit the free-trial cap. */
export function guestMustRegister(): boolean {
  if (isLoggedIn()) return false;
  return getGuestGamesPlayed() >= GUEST_GAME_LIMIT;
}
