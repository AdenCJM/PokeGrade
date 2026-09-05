import Link from "next/link";
import { GITHUB_URL, Wordmark } from "@/components/site/nav";

export default function Footer({
  engineVersion = "0.1.0",
  standardsVersion = "1.0.0",
}: {
  engineVersion?: string;
  standardsVersion?: string;
}) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <Wordmark />
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              Free, and the engine is on GitHub. If a hosted version ever
              charges, the log stays open and free.
            </p>
            <p className="mt-3 text-[13px] text-faint">
              Built by{" "}
              <a href="https://github.com/AdenCJM" className="underline decoration-border-strong underline-offset-4 hover:text-fg" target="_blank" rel="noreferrer">
                Aden Mann
              </a>
              .
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[14px] sm:grid-cols-3">
            <Link href="/#screen" className="text-muted hover:text-fg">Screen a card</Link>
            <Link href="/sample" className="text-muted hover:text-fg">Real run</Link>
            <Link href="/#how" className="text-muted hover:text-fg">How it works</Link>
            <Link href="/#log" className="text-muted hover:text-fg">The log</Link>
            <Link href="/#run" className="text-muted hover:text-fg">Run it yourself</Link>
            <a href={GITHUB_URL} className="text-muted hover:text-fg" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <p className="mt-10 max-w-4xl text-[12px] leading-relaxed text-faint">
          PokeGrade is an independent project. It is not affiliated with,
          endorsed by, or connected to PSA, Beckett (BGS), CGC or any grading
          company, and it does not issue grades. Grading company names are used
          only to describe the standards this tool estimates against. Pokémon
          and Pokémon character names are trademarks of Nintendo, Creatures Inc.
          and GAME FREAK Inc. Card photographs are of cards the author owns; the
          artwork remains the copyright of its owners. This project is unrelated
          to PokeGrade.AI.
        </p>
        <p className="mt-4 font-mono text-[12px] text-faint">
          engine {engineVersion} · standards {standardsVersion} · centering keeps
          PSA&rsquo;s spelling
        </p>
      </div>
    </footer>
  );
}
