"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Overview" },
  { href: "/match", label: "Find Trials" },
  { href: "/data", label: "The Corpus" },
  { href: "/saved", label: "Saved" },
  { href: "/about", label: "How It Works" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on escape, outside click, or route change
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      ref={menuRef}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-line-soft"
          : "bg-transparent"
      )}
    >
      <nav className="max-w-wide mx-auto px-6 h-12 flex items-center justify-between" aria-label="Main">
        <Link href="/" className="flex items-center gap-1.5 text-fg" aria-label="CureMatch home">
          <Activity className="w-4 h-4" strokeWidth={2.25} aria-hidden="true" />
          <span className="text-[17px] font-semibold tracking-tight">CureMatch</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "px-3 py-1.5 text-[13px] transition-colors rounded-md",
                  isActive ? "text-fg font-medium" : "text-fg-mute hover:text-fg"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:block">
          <Link
            href="/match"
            className="inline-flex items-center h-8 px-4 text-[13px] font-medium bg-accent hover:bg-accent-hover text-white rounded-full transition-colors"
          >
            Get Matched
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="md:hidden p-1 text-fg"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div id="mobile-menu" className="md:hidden bg-white border-t border-line-soft">
          <div className="px-6 py-4 space-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "block py-2 text-[17px] transition-colors",
                  pathname === link.href ? "text-fg font-medium" : "text-fg-mute"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/match"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center h-9 px-4 mt-2 text-[14px] font-medium bg-accent text-white rounded-full"
            >
              Get Matched
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
