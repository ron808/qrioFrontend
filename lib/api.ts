import type { Question, QuestionDifficulty, User } from "./types";

const PROD_API_URL = "https://qrio-backend-latest.onrender.com";
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i;

function isLanHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

/**
 * Resolve the backend base URL.
 *
 * Priority:
 *   1. An explicit non-localhost NEXT_PUBLIC_API_URL (e.g. set on Vercel).
 *   2. LAN dev mode: if the page is loaded from a LAN/local hostname, derive
 *      `http://<that-host>:8081` so a phone on WiFi talks to the right machine.
 *   3. Production fallback: the deployed Render backend.
 *
 * Localhost-shaped env values are ignored in the browser — Next.js inlines
 * NEXT_PUBLIC_* at build time, so letting them win would make every phone
 * try to reach its own localhost.
 */
function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  const hasRealEnvUrl = envUrl && !LOCALHOST_RE.test(envUrl);

  if (typeof window === "undefined") {
    return hasRealEnvUrl ? envUrl! : PROD_API_URL;
  }

  if (hasRealEnvUrl) return envUrl!;

  if (isLanHost(window.location.hostname)) {
    const port = process.env.NEXT_PUBLIC_API_PORT || "8081";
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }

  return PROD_API_URL;
}

/** True when the app is being served from this machine or the local network. */
export function isLocalDev(): boolean {
  return typeof window !== "undefined" && isLanHost(window.location.hostname);
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("qrio_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  // A cold or crashed backend can answer with an HTML error page, so don't
  // assume the body is JSON.
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Server error (${res.status}). Please try again.`);
  if (data === null) throw new Error("The server sent an unreadable response.");
  return data as T;
}

export const api = {
  register: (email: string, username: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  generateQuestions: (tags: string[], count: number, questionDifficulty: QuestionDifficulty = "medium") =>
    request<{ questions: Question[] }>("/api/game/generate", {
      method: "POST",
      body: JSON.stringify({ tags, count, question_difficulty: questionDifficulty }),
    }),

  // The server generates and keeps the questions so the host never sees the answers.
  createRoom: (
    tags: string[],
    count: number,
    hostUsername: string,
    questionDifficulty: QuestionDifficulty = "medium",
  ) =>
    request<{ room_code: string; session_id: number }>("/api/room/create", {
      method: "POST",
      body: JSON.stringify({
        tags,
        count,
        host_username: hostUsername,
        question_difficulty: questionDifficulty,
      }),
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    // The server signs out other sessions and returns a fresh token for this one.
    request<{ message: string; token: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),

  /** Step 1 of a reset: the server issues a one-time code for this email. */
  forgotPassword: (email: string) =>
    request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  /** Step 2 of a reset: trade the code for a new password. */
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, code, new_password: newPassword }),
    }),
};

/**
 * `rejoinToken` is the secret the server handed this browser on its first
 * join; it lets the same player reclaim their seat (and score) after a drop
 * without letting anyone else take the name.
 */
export function createWebSocket(roomCode: string, username: string, rejoinToken?: string | null): WebSocket {
  const wsBase = getApiBase().replace(/^http/, "ws");
  const params = new URLSearchParams({ room: roomCode, username });
  if (rejoinToken) params.set("token", rejoinToken);
  return new WebSocket(`${wsBase}/ws?${params}`);
}
