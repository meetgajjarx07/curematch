"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Shield, AlertTriangle } from "lucide-react";
import SceneErrorBoundary from "@/components/three/SceneErrorBoundary";

const PipelineScrollSection = dynamic(() => import("@/components/three/PipelineScrollSection"), {
  ssr: false,
  loading: () => <div style={{ height: "450vh" }} className="bg-[#05070F]" />,
});

export default function AboutPage() {
  return (
    <div className="bg-paper">
      {/* Hero */}
      <section className="max-w-apple mx-auto px-6 pt-20 pb-16 text-center">
        <p className="eyebrow-sm mb-5 text-accent">How It Works</p>
        <h1 className="hero-headline mb-6 text-balance">
          Transparent by design.
        </h1>
        <p className="text-[21px] text-fg-mute max-w-2xl mx-auto leading-snug">
          A deterministic approach to clinical trial matching. No opaque scores.
          No hidden AI decisions. Every criterion shown.
        </p>
        <p className="mt-12 text-[12px] font-semibold uppercase tracking-[0.2em] text-fg-faint flex items-center justify-center gap-3">
          <span className="inline-block w-8 h-px bg-fg-faint" />
          Scroll to see the pipeline
          <span className="inline-block w-8 h-px bg-fg-faint" />
        </p>
      </section>

      {/* Bridge: paper → deep */}
      <div className="h-24 bg-gradient-to-b from-paper to-deep" aria-hidden="true" />

      {/* 3D Pipeline scroll scene */}
      <SceneErrorBoundary fallback={<div style={{ height: "100vh" }} className="bg-deep" />}>
        <PipelineScrollSection />
      </SceneErrorBoundary>

      {/* Bridge: deep → paper */}
      <div className="h-24 bg-gradient-to-b from-deep to-paper" aria-hidden="true" />

      {/* Verdicts */}
      <section className="section-pad">
        <div className="max-w-apple mx-auto px-6">
          <div className="text-center mb-14">
            <p className="eyebrow-sm mb-3">Verdicts</p>
            <h2 className="section-headline text-balance max-w-2xl mx-auto">
              Four categories.
              <br />
              <span className="text-fg-mute">No shades of grey.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Match", color: "bg-success", text: "text-success", desc: "Your value satisfies the criterion." },
              { label: "Excluded", color: "bg-error", text: "text-error", desc: "Your value disqualifies you." },
              { label: "Unknown", color: "bg-warning", text: "text-warning", desc: "You didn't provide a value." },
              { label: "N/A", color: "bg-line", text: "text-fg-faint", desc: "Criterion isn't applicable." },
            ].map((v, i) => (
              <div key={i} className="bg-white border border-line-soft rounded-2xl p-6 flex items-start gap-4">
                <div className={`w-3 h-3 rounded-full ${v.color} mt-1.5 flex-shrink-0`} />
                <div>
                  <p className={`text-[17px] font-semibold mb-1 ${v.text}`}>{v.label}</p>
                  <p className="text-[14px] text-fg-mute">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bridge: paper → dark */}
      <div className="h-24 bg-gradient-to-b from-paper to-dark" aria-hidden="true" />

      {/* Privacy + Limitations */}
      <section className="bg-dark text-white section-pad">
        <div className="max-w-apple mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <Shield className="w-7 h-7 text-accent-dark mb-4" strokeWidth={2} />
              <h3 className="text-[24px] font-semibold mb-3 tracking-tight">Privacy</h3>
              <p className="text-[15px] text-white/70 leading-relaxed">
                Your medical profile never leaves your browser. No accounts, no tracking,
                no cookies, no analytics. The entire apparatus costs $0 to operate and
                benefits from no one&apos;s data.
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <AlertTriangle className="w-7 h-7 text-warning mb-4" strokeWidth={2} />
              <h3 className="text-[24px] font-semibold mb-3 tracking-tight">Limitations</h3>
              <ul className="text-[15px] text-white/70 leading-relaxed space-y-3">
                <li><strong className="text-white">Research prototype.</strong> Not a medical device.</li>
                <li><strong className="text-white">Always consult your physician.</strong> Match ≠ enrollment.</li>
                <li><strong className="text-white">~85–90% parse accuracy.</strong> Some criteria may be missed.</li>
                <li><strong className="text-white">Updated weekly.</strong> Verify status on ClinicalTrials.gov.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Bridge: dark → paper */}
      <div className="h-24 bg-gradient-to-b from-dark to-paper" aria-hidden="true" />

      {/* CTA */}
      <section className="section-pad">
        <div className="max-w-apple mx-auto px-6 text-center">
          <h2 className="mega-headline mb-6 text-balance">
            Ready?
            <br />
            <span className="text-fg-mute">Find your trial.</span>
          </h2>
          <Link href="/match" className="btn-primary">
            Get Matched <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
