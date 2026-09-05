import Link from "next/link";
import Nav from "@/components/site/nav";
import Footer from "@/components/site/footer";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-col items-start px-5 py-24 sm:px-8">
        <p className="eyebrow">404</p>
        <h1 className="display mt-3 text-[2rem] text-fg sm:text-[2.6rem]">Nothing at this address.</h1>
        <p className="mt-4 max-w-md text-[15px] text-muted">
          Could not assess, honestly. The card screener and the real run are back on the front page.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-accent-fg transition hover:opacity-90"
        >
          Back to PokeGrade
        </Link>
      </main>
      <Footer />
    </>
  );
}
