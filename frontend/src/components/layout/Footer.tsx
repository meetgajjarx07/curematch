"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-paper-alt text-fg-mute text-[12px]">
      <div className="max-w-wide mx-auto px-6 py-10">
        <div className="pb-6 border-b border-line-soft">
          <p className="leading-relaxed max-w-3xl">
            CureMatch is a research prototype and does not constitute medical advice.
            Always consult your physician before enrolling in any clinical trial.
            Final eligibility is determined by each trial&apos;s investigators.
          </p>
        </div>

        <div className="pt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="hover:text-fg transition-colors">Overview</Link>
            <Link href="/match" className="hover:text-fg transition-colors">Find Trials</Link>
            <Link href="/data" className="hover:text-fg transition-colors">The Corpus</Link>
            <Link href="/saved" className="hover:text-fg transition-colors">Saved</Link>
            <Link href="/about" className="hover:text-fg transition-colors">How It Works</Link>
            <a
              href="https://clinicaltrials.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fg transition-colors"
            >
              ClinicalTrials.gov ↗
            </a>
          </div>
          <p>© {new Date().getFullYear()} CureMatch. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
