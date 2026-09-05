import Link from "next/link";
import ModeBadge from "@/components/site/mode-badge";
import ThemeToggle from "@/components/site/theme-toggle";

export const GITHUB_URL = "https://github.com/AdenCJM/PokeGrade";

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-fg" aria-label="PokeGrade home">
      <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14"  style={{ fill: "var(--accent)" }}/>
        <rect x="17" y="11" width="30" height="42" rx="3" fill="none" strokeWidth="3.2"  style={{ stroke: "var(--ov-card)" }}/>
        <rect x="24" y="17" width="19" height="30" rx="1.5" fill="none" strokeWidth="2.6"  style={{ stroke: "var(--ov-border)" }}/>
        <path d="M17 32h7M40 32h7M32 11v6M32 47v6" strokeWidth="2.6" strokeLinecap="round"  style={{ stroke: "var(--ov-border)" }}/>
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">PokeGrade</span>
    </Link>
  );
}

const LINKS = [
  { href: "/#screen", label: "Screen" },
  { href: "/#real-run", label: "Real run" },
  { href: "/#how", label: "How it works" },
  { href: "/#log", label: "The log" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-[14px] text-muted transition hover:bg-surface2 hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-1.5 text-[14px] text-muted transition hover:bg-surface2 hover:text-fg"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ModeBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
