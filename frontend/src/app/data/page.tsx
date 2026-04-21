"use client";

import dynamic from "next/dynamic";

const CorpusDashboard = dynamic(() => import("@/components/dashboard/CorpusDashboard"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-64 bg-paper-alt rounded-2xl animate-pulse" />
      ))}
    </div>
  ),
});

export default function DataPage() {
  return (
    <div className="bg-paper">
      {/* Hero */}
      <section className="max-w-wide mx-auto px-6 pt-16 pb-10">
        <p className="eyebrow-sm mb-4 text-accent">The Corpus</p>
        <h1 className="mega-headline mb-4 text-balance">
          65,081 trials,
          <br />
          <span className="text-fg-mute">in numbers.</span>
        </h1>
        <p className="text-[18px] md:text-[20px] text-fg-mute max-w-2xl leading-snug">
          Live statistics from the ClinicalTrials.gov corpus — indexed, parsed,
          and ready for matching. What our agent is grounded in.
        </p>
      </section>

      {/* Dashboard */}
      <section className="max-w-wide mx-auto px-6 pb-24">
        <CorpusDashboard />
      </section>
    </div>
  );
}
