import type { Question, QuestionDifficulty, User } from "./types";

/**
 * Derive the backend base URL at call-time from the browser's current hostname.
 * This makes LAN play work automatically: if the page is loaded from
 * http://192.168.1.5:3000, API calls go to http://192.168.1.5:8081 — no config
 * needed on phones/other devices.
 *
 * Falls back to NEXT_PUBLIC_API_URL during SSR (no window).
 */
function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // SSR — no window, use env or fall back to localhost.
  if (typeof window === "undefined") {
    return envUrl || "http://localhost:8081";
  }

  // Production deploy: an explicit non-localhost URL always wins.
  // (Localhost values in .env.local are SSR fallbacks only — using them in
  // the browser would break LAN devices like phones, which would try to
  // reach their *own* localhost.)
  if (envUrl && !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(envUrl)) {
    return envUrl;
  }

  // LAN dev mode: derive backend host from the current page hostname so a
  // phone hitting http://192.168.1.5:3000 talks to http://192.168.1.5:8081.
  const port = process.env.NEXT_PUBLIC_API_PORT || "8081";
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
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
