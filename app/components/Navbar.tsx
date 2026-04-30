"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, LogOut, Menu, Target, User as UserIcon, Users, X } from "lucide-react";
import { clearAuth, getUser, getHomePath, isLoggedIn } from "@/lib/auth";
import ThemeToggle from "./ThemeToggle";

interface NavbarProps {
  /** Optional title shown next to the logo (e.g. "Lone Wolf"). */
  title?: string;
  /** When true, shows a back button instead of full nav links. */
  showBack?: boolean;
  /** Where the back button goes (defaults to home). */
  backHref?: string;
  /** Hide the user info / nav links — useful on auth/room pages. */
  minimal?: boolean;
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

  const navLinks = loggedIn
    ? [
        { href: "/dashboard",    label: "Home",        icon: <UserIcon size={15} /> },
        { href: "/solo",         label: "Lone Wolf",   icon: <Target   size={15} /> },
        { href: "/multiplayer",  label: "Multiplayer", icon: <Users    size={15} /> },
      ]
    : [];

  return (
    <motion.nav
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b-2 border-ink bg-card/95 backdrop-blur-sm"
    >
      {/* Left: brand + back/title */}
      <div className="flex items-center gap-3 min-w-0">
        {showBack ? (
          <button
            onClick={() => router.push(backHref ?? getHomePath())}
            className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors text-sm font-bold focus-ring rounded-md px-1 py-1"
            aria-label="Go back"
          >
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <button
            onClick={() => router.push(getHomePath())}
            className="font-marker text-2xl sm:text-3xl text-ink leading-none focus-ring rounded-md"
            aria-label="Qrio home"
          >
            Qrio
          </button>
        )}
        {title && (
          <>
            <span className="text-ink-ghost hidden sm:inline">·</span>
            <span className="font-marker text-lg sm:text-2xl text-ink truncate">{title}</span>
          </>
        )}
      </div>

      {/* Right: links + user + theme — desktop */}
      {!minimal && (
        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((l) => {
            const active = pathname === l.href;
            return (
              <button
                key={l.href}
                onClick={() => router.push(l.href)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors focus-ring ${
                  active
                    ? "bg-ink text-on-ink"
                    : "text-ink-soft hover:text-ink hover:bg-card-soft"
                }`}
              >
                {l.icon}
                {l.label}
              </button>
            );
          })}
          {user && (
            <div className="flex items-center gap-2 sketch-card-sm px-3 py-1.5 ml-2">
              <UserIcon size={13} className="text-ink-muted" />
              <span className="text-xs font-bold text-ink truncate max-w-[120px]">{user.username}</span>
            </div>
          )}
          <ThemeToggle />
          {loggedIn && (
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="flex items-center gap-1.5 text-sm font-bold text-ink-muted hover:text-ink transition-colors px-2 py-2 rounded-lg focus-ring"
            >
              <LogOut size={14} />
              <span className="hidden lg:inline">Logout</span>
            </button>
          )}
        </div>
      )}

      {/* Right: theme toggle (always) + mobile menu trigger */}
      <div className="flex md:hidden items-center gap-2">
        <ThemeToggle />
        {!minimal && loggedIn && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="w-10 h-10 inline-flex items-center justify-center rounded-xl border-2 border-ink bg-card text-ink shadow-[3px_3px_0_var(--shadow)] focus-ring"
          >
            <AnimatePresence mode="wait" initial={false}>
              {menuOpen ? (
                <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <X size={18} />
                </motion.span>
              ) : (
                <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Menu size={18} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
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
              className="fixed inset-0 top-[57px] bg-black/30 md:hidden z-40"
              aria-hidden
            />
            <motion.div
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden absolute left-0 right-0 top-full bg-card border-b-2 border-ink shadow-[0_6px_0_var(--shadow)] z-40 px-4 py-4 space-y-2"
              role="menu"
            >
              {user && (
                <div className="flex items-center gap-2 sketch-card-sm px-3 py-2 mb-2">
                  <UserIcon size={14} className="text-ink-muted" />
                  <span className="text-sm font-bold text-ink">{user.username}</span>
                </div>
              )}
              {navLinks.map((l) => {
                const active = pathname === l.href;
                return (
                  <button
                    key={l.href}
                    onClick={() => { setMenuOpen(false); router.push(l.href); }}
                    role="menuitem"
                    className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-bold transition-colors focus-ring ${
                      active ? "bg-ink text-on-ink" : "text-ink hover:bg-card-soft"
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
                  className="w-full flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-bold text-ink-muted hover:text-ink hover:bg-card-soft focus-ring"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
