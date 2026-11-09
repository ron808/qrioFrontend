"use client";

import { useRouter } from "@/lib/navigation";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

/** Top bar shared by the sign-in screens: home link and theme switch. */
export default function AuthBar({ backHref = "/", backLabel = "Home" }: { backHref?: string; backLabel?: string }) {
  const router = useRouter();
  return (
    <div className="max-w-5xl w-full mx-auto h-16 px-4 sm:px-6 flex items-center justify-between">
      <button
        onClick={() => router.push(backHref)}
        className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 h-10 text-sm font-extrabold text-ink-soft hover:text-ink transition-colors focus-ring"
      >
        <ArrowLeft size={16} /> {backLabel}
      </button>
      <ThemeToggle />
    </div>
  );
}
