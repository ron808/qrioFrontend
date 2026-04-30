"use client";

import { motion } from "framer-motion";
import { pageTransition } from "@/lib/motion";
import Navbar from "./Navbar";

interface Props {
  children: React.ReactNode;
  /** Title shown in the navbar (next to brand) */
  title?: string;
  /** Show back button instead of nav links */
  showBack?: boolean;
  backHref?: string;
  /** Hide nav links (e.g. auth/room pages) */
  minimalNav?: boolean;
  /** Skip navbar entirely (for fully-immersive screens) */
  noNav?: boolean;
  /** Outer wrapper className for the content area */
  className?: string;
}

export default function PageShell({
  children,
  title,
  showBack = false,
  backHref,
  minimalNav = false,
  noNav = false,
  className = "",
}: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      {!noNav && (
        <Navbar title={title} showBack={showBack} backHref={backHref} minimal={minimalNav} />
      )}
      <motion.main
        variants={pageTransition}
        initial="hidden"
        animate="show"
        exit="exit"
        className={`flex-1 flex flex-col ${className}`}
      >
        {children}
      </motion.main>
    </div>
  );
}
