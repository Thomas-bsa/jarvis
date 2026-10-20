"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "Accueil",
    icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    href: "/saisie",
    label: "Saisie",
    icon: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  },
  {
    href: "/orga",
    label: "Orga",
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4M8 14.5l2 2 4-4" />
      </>
    ),
  },
  {
    href: "/bilan",
    label: "Jarvis",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    href: "/reglages",
    label: "Réglages",
    icon: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" />,
  },
];

export function NavBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Navigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-[#070C12]/95 backdrop-blur"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-2">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 flex-col items-center gap-1 text-[11px] ${active ? "text-cyan" : "text-muted hover:text-ink-2"}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {it.icon}
              </svg>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
