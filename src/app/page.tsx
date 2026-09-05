import Link from "next/link";
import Nav from "@/components/site/nav";
import Hero from "@/components/site/hero";
import Footer from "@/components/site/footer";
import Screener from "@/components/screener";
import Result from "@/components/result/result";
import {
  Honesty,
  HowItWorks,
  Maths,
  RunItYourself,
  Section,
  VerifiedLog,
} from "@/components/site/sections";
import { SAMPLE_META, SAMPLE_PIKACHU_EX } from "@/data/sample-pikachu-ex";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />

        <Section
          id="screen"
          eyebrow="Screen a card"
          title="A front photo is required. The back and close-ups make the call sharper."
          lead="Shoot flat and square-on, filling the frame, on a plain mid-grey background. Centering is measured from the pixels, so the shot matters as much as the card."
          className="border-t border-border"
        >
          <Screener />
        </Section>

        <Section
          id="real-run"
          eyebrow="A real screening run"
          title="What a verdict looks like, on a card I own."
          lead={
            <>
              {SAMPLE_META.title}, screened {SAMPLE_META.screened_label}. {SAMPLE_META.capture}{" "}
              Everything below is what the engine returned, not a mock-up.{" "}
              <Link href="/sample/verdict.json" target="_blank" rel="noreferrer" className="underline decoration-border-strong underline-offset-4 hover:text-fg">
                Raw JSON
              </Link>
              .
            </>
          }
          className="border-t border-border bg-surface2/30"
        >
          <Result result={SAMPLE_PIKACHU_EX} images={{ front: SAMPLE_META.images.front, back: SAMPLE_META.images.back, closeups: [] }} kind="sample" />
        </Section>

        <HowItWorks />
        <Maths />
        <Honesty />
        <div className="border-t border-border bg-surface2/30">
          <VerifiedLog />
        </div>
        <div className="border-t border-border">
          <RunItYourself />
        </div>
      </main>
      <Footer engineVersion={SAMPLE_PIKACHU_EX.engine_version} standardsVersion={SAMPLE_PIKACHU_EX.standards_version} />
    </>
  );
}
