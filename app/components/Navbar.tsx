"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, KeyRound, LayoutGrid, LogOut, Menu, Target, Users, X } from "lucide-react";
import { clearAuth, getUser, getHomePath, isLoggedIn } from "@/lib/auth";
import { EASE } from "@/lib/motion";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";

interface NavbarProps {
  /** Optional title shown next to the logo (e.g. "Lone Wolf"). */
  title?: string;
  /** When true, shows a back button instead of the logo. */
  showBack?: boolean;
  /** Where the back button goes (defaults to home). */
  backHref?: string;
  /** Hide the user info / nav links — useful on auth/room pages. */
  minimal?: boolean;
}

/** First letter of a name in a little ink circle. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink bg-hl text-hl-ink font-heading"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export default function Navbar({ title, showBack = false, backHref, minimal = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setLoggedIn(isLoggedIn());
  }, [pathname]);

  function handleLogout() {
    clearAuth();
    router.push("/");
  }

  function handleBack() {
    // Prefer the real browser back so users return to where they came from.
    // Fall back to backHref / home when there's no entry above the current
    // page (e.g. they opened the URL directly).
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref ?? getHomePath());
  }

  const navLinks = loggedIn
    ? [
        { href: "/dashboard",   label: "Home",        icon: <LayoutGrid size={16} /> },
        { href: "/solo",        label: "Lone Wolf",   icon: <Target     size={16} /> },
        { href: "/multiplayer", label: "Multiplayer", icon: <Users      size={16} /> },
        { href: "/account",     label: "Account",     icon: <KeyRound   size={16} /> },
      ]
    : [];

  return (
    <nav className="sticky top-0 z-30 h-16 border-b-2 border-ink bg-card">
      <div className="h-full max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: brand or back, plus the page title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {showBack ? (
            <button
              onClick={handleBack}
              className="-ml-2 flex items-center gap-0.5 rounded-lg px-2 h-10 text-sm font-extrabold text-ink-soft hover:text-ink transition-colors focus-ring"
              aria-label="Go back"
            >
              <ChevronLeft size={20} /> Back
            </button>
          ) : (
            <button
              onClick={() => router.push(getHomePath())}
              className="text-[28px] focus-ring rounded-md"
              aria-label="Qrio home"
            >
              <Logo />
            </button>
          )}
          {title && (
            <>
              <span aria-hidden="true" className="h-6 w-0.5 rounded-full" style={{ background: "var(--line-soft)" }} />
              <span className="font-heading text-lg sm:text-xl text-ink truncate">{title}</span>
            </>
          )}
        </div>

        {/* Right, desktop: links, user, theme, logout */}
        {!minimal && (
          <div className="hidden md:flex items-center gap-1.5">
            {navLinks.map((l) => {
              const active = pathname === l.href;
              return (
                <button
                  key={l.href}
                  onClick={() => router.push(l.href)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 h-10 px-3 rounded-lg border-2 text-sm font-extrabold transition-colors focus-ring ${
                    active
                      ? "bg-hl text-hl-ink border-ink"
                      : "border-transparent text-ink-soft hover:text-ink hover:border-line-soft"
                  }`}
                >
                  {l.icon}
                  {l.label}
                </button>
              );
            })}
            {user && (
              <span className="ml-2 mr-1 flex items-center gap-2 text-sm font-extrabold text-ink" title={user.email}>
                <Avatar name={user.username} />
                <span className="truncate max-w-[120px] hidden lg:inline">{user.username}</span>
              </span>
            )}
            <ThemeToggle />
            {loggedIn && (
              <button
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink transition-colors focus-ring"
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        )}

        {/* Right, phones (and minimal pages): theme + menu */}
        <div className={`flex items-center gap-2 ${minimal ? "" : "md:hidden"}`}>
          <ThemeToggle />
          {!minimal && loggedIn && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="sketch-btn-light w-10 h-10 focus-ring"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && !minimal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 top-16 bg-black/35 md:hidden z-40"
              aria-hidden
            />
            <motion.div
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="md:hidden absolute left-0 right-0 top-full bg-card border-b-2 border-ink shadow-[0_5px_0_var(--shadow)] z-40 px-4 pt-3 pb-4 space-y-1"
              role="menu"
            >
              {user && (
                <div className="flex items-center gap-3 px-3 py-3 mb-1 border-b-2 border-dashed border-line-soft">
                  <Avatar name={user.username} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-ink truncate">{user.username}</p>
                    <p className="text-xs font-semibold text-ink-muted truncate">{user.email}</p>
                  </div>
                </div>
              )}
              {navLinks.map((l) => {
                const active = pathname === l.href;
                return (
                  <button
                    key={l.href}
                    onClick={() => { setMenuOpen(false); router.push(l.href); }}
                    role="menuitem"
                    className={`w-full flex items-center gap-3 px-3 h-12 rounded-xl border-2 text-base font-extrabold transition-colors focus-ring ${
                      active ? "bg-hl text-hl-ink border-ink" : "border-transparent text-ink hover:bg-card-soft"
                    }`}
                  >
                    {l.icon}
                    {l.label}
                  </button>
                );
              })}
              {loggedIn && (
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-3 h-12 rounded-xl text-base font-extrabold text-ink-muted hover:text-ink hover:bg-card-soft focus-ring"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
