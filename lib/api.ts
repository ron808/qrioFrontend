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

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
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

  createRoom: (questions: Question[], tags: string[]) =>
    request<{ room_code: string; session_id: number }>("/api/room/create", {
      method: "POST",
      body: JSON.stringify({ questions, tags }),
    }),
};

export function createWebSocket(roomCode: string, username: string): WebSocket {
  const wsBase = getApiBase().replace(/^http/, "ws");
  return new WebSocket(
    `${wsBase}/ws?room=${encodeURIComponent(roomCode)}&username=${encodeURIComponent(username)}`
  );
}
