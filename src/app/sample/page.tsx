import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/site/nav";
import Footer from "@/components/site/footer";
import Result from "@/components/result/result";
import { SAMPLE_META, SAMPLE_PIKACHU_EX } from "@/data/sample-pikachu-ex";

export const metadata: Metadata = {
  title: `Real run: ${SAMPLE_META.title}`,
  description:
    "A real PokeGrade screening run. Pikachu ex measured 58.5/41.5 on the front, past the PSA-10 centering gate, so the verdict was skip and the $165 fee stayed unspent.",
  alternates: { canonical: "/sample" },
  openGraph: {
    title: "Skip: Pikachu ex measured 58.5/41.5",
    description: "A real PokeGrade screening run, front and back phone photos only. Past the PSA-10 centering gate, so the $165 fee stayed unspent.",
  },
};

export default function SamplePage() {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="max-w-2xl">
          <p className="eyebrow">A real screening run</p>
          <h1 className="display mt-3 text-[1.9rem] text-fg sm:text-[2.4rem]">
            {SAMPLE_META.title}, screened {SAMPLE_META.screened_label}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">
            {SAMPLE_META.capture} Everything below is what the engine returned,
            not a mock-up. The verdict and measurements come from the ledger;
            the model&rsquo;s written narrative was not retained.{" "}
            <Link href="/sample/verdict.json" className="underline decoration-border-strong underline-offset-4 hover:text-fg">
              Raw JSON
            </Link>
            .
          </p>
        </div>
        <div className="mt-10">
          <Result
            result={SAMPLE_PIKACHU_EX}
            images={{ front: SAMPLE_META.images.front, back: SAMPLE_META.images.back, closeups: [] }}
            kind="sample"
          />
        </div>
      </main>
      <Footer engineVersion={SAMPLE_PIKACHU_EX.engine_version} standardsVersion={SAMPLE_PIKACHU_EX.standards_version} />
    </>
  );
}
