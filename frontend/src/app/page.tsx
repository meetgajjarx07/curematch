"use client";

import Link from "next/link";
import { useRef } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight, Zap, Shield, Globe, Search, Sparkles,
  Activity, Heart, Brain, Dna, Ribbon,
} from "lucide-react";
import { useGSAP, gsap, SplitText } from "@/lib/gsap";
import MatchCard, { MatchCardRow } from "@/components/marketing/MatchCard";
import SceneErrorBoundary from "@/components/three/SceneErrorBoundary";
import { FEATURED_CONDITIONS } from "@/lib/mock-data";

const ScrollScene = dynamic(() => import("@/components/three/ScrollScene"), {
  ssr: false,
  loading: () => <div style={{ height: "500vh" }} className="bg-paper" />,
});

const conditionIcons: Record<string, typeof Ribbon> = {
  ribbon: Ribbon, activity: Activity, heart: Heart, brain: Brain, shield: Shield, dna: Dna,
};

export default function LandingPage() {
  const mainRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Mini hero entrance
  useGSAP(
    () => {
      if (!heroRef.current) return;

      const splitTitle = SplitText.create(".hero-title", {
        type: "lines, words",
        mask: "lines",
      });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.7 })
        .from(splitTitle.words, {
          yPercent: 110,
          duration: 1.0,
          stagger: 0.04,
          ease: "power4.out",
        }, "<0.1")
        .from(".hero-sub", { opacity: 0, y: 12, duration: 0.8 }, "<0.3")
        .from(".hero-cta > *", { opacity: 0, y: 8, duration: 0.6, stagger: 0.06 }, "<0.15")
        .from(".hero-hint", { opacity: 0, duration: 0.8 }, "<0.3");

      return () => { splitTitle.revert(); };
    },
    { scope: heroRef }
  );

  // Generic scroll reveals
  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>(".scroll-words").forEach((el) => {
        const split = SplitText.create(el, { type: "words, lines", mask: "lines" });
        gsap.from(split.words, {
          yPercent: 110,
          opacity: 0,
          duration: 0.9,
          stagger: 0.04,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-count-to]").forEach((el) => {
        const to = Number(el.dataset.countTo || 0);
        const format = el.dataset.format || "integer";
        const obj = { val: 0 };
        gsap.to(obj, {
          val: to, duration: 1.6, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" },
          onUpdate: () => {
            const v = Math.round(obj.val);
            el.textContent = format === "comma" ? v.toLocaleString() : String(v);
          },
        });
      });

      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
        gsap.from(el, {
          opacity: 0, y: 30, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" },
        });
      });

      gsap.utils.toArray<HTMLElement>(".reveal-batch").forEach((container) => {
        const items = container.querySelectorAll<HTMLElement>(":scope > *");
        gsap.from(items, {
          opacity: 0, y: 24, duration: 0.8, stagger: 0.08, ease: "power3.out",
          scrollTrigger: { trigger: container, start: "top 85%", toggleActions: "play none none none" },
        });
      });
    },
    { scope: mainRef }
  );

  return (
    <div ref={mainRef} className="bg-paper">
      {/* ============ HERO (not pinned — just entrance) ============ */}
      <section ref={heroRef} className="relative min-h-[85vh] flex items-center">
        <div className="max-w-wide mx-auto px-6 w-full py-20 text-center">
          <p className="hero-eyebrow eyebrow-sm mb-5">Clinical Trial Matching</p>
          <h1 className="hero-title hero-headline mb-6 text-balance max-w-4xl mx-auto">
            Find the trial
            <br />
            you qualify for.
          </h1>
          <p className="hero-sub text-[19px] md:text-[22px] text-fg-mute max-w-2xl mx-auto mb-10 leading-snug">
            Enter your medical profile. We screen every actively recruiting trial on
            ClinicalTrials.gov — and show you exactly why you qualify.
          </p>
          <div className="hero-cta flex items-center justify-center gap-5">
            <Link href="/match" className="btn-primary">
              Get Matched <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/about" className="btn-secondary">
              Learn more <ArrowRight className="w-4 h-4 arrow" />
            </Link>
          </div>

          <p className="hero-hint mt-16 text-[12px] font-semibold uppercase tracking-[0.2em] text-fg-faint flex items-center justify-center gap-3">
            <span className="inline-block w-8 h-px bg-fg-faint" />
            Scroll to begin the story
            <span className="inline-block w-8 h-px bg-fg-faint" />
          </p>
        </div>
      </section>

      {/* Bridge: paper → deep */}
      <div className="h-24 bg-gradient-to-b from-paper to-deep" aria-hidden="true" />

      {/* ============ 3D SCROLL STORYTELLING ============ */}
      <SceneErrorBoundary fallback={<div style={{ height: "100vh" }} className="bg-deep" />}>
        <ScrollScene />
      </SceneErrorBoundary>

      {/* Bridge: deep → dark */}
      <div className="h-24 bg-gradient-to-b from-deep to-dark" aria-hidden="true" />

      {/* ============ DARK CHIP SECTION ============ */}
      <section className="bg-dark text-white section-pad">
        <div className="max-w-apple mx-auto px-6 text-center">
          <p className="reveal eyebrow-sm text-white/50 mb-5">The Matching Engine</p>
          <h2 className="scroll-words mega-headline mb-6 text-balance">
            Deterministic.
            Transparent.
            No AI during matching.
          </h2>
          <p className="reveal text-[20px] text-white/60 max-w-2xl mx-auto leading-relaxed mb-16">
            Parse every trial&apos;s eligibility once, offline. When you search, it&apos;s
            a deterministic comparison — no language model hallucinating into your result.
          </p>

          <div className="reveal-batch grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-4xl mx-auto pt-12 border-t border-white/10">
            {[
              { n: 65081, label: "Trials indexed", format: "comma" },
              { n: 50, label: "Countries", suffix: "+" },
              { n: 6, label: "Criteria per match" },
              { n: 0, label: "AI during match" },
            ].map((spec, i) => (
              <div key={i} className="text-center md:text-left">
                <div className="text-[44px] md:text-[56px] font-semibold leading-none tabular mb-2 flex items-baseline md:justify-start justify-center">
                  <span data-count-to={spec.n} data-format={spec.format}>0</span>
                  {spec.suffix && <span>{spec.suffix}</span>}
                </div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-white/50">
                  {spec.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bridge: dark → paper-alt */}
      <div className="h-24 bg-gradient-to-b from-dark to-paper-alt" aria-hidden="true" />

      {/* ============ PRODUCT SHOWCASE ============ */}
      <section className="section-pad bg-paper-alt">
        <div className="max-w-wide mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <p className="reveal eyebrow-sm mb-4">Per-Criterion Verdicts</p>
              <h2 className="scroll-words section-headline mb-6 text-balance">
                Every criterion.
                Every time.
              </h2>
              <p className="reveal text-[18px] text-fg-mute leading-relaxed mb-6">
                Each trial&apos;s eligibility criteria gets compared, one by one, against
                your profile. The result isn&apos;t a black-box score — it&apos;s a visible ledger.
              </p>
              <ul className="reveal-batch space-y-3 text-[15px]">
                {[
                  { color: "bg-success", text: "Match — your value satisfies the criterion" },
                  { color: "bg-error", text: "Excluded — your value disqualifies you" },
                  { color: "bg-warning", text: "Unknown — you didn't provide a value" },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-fg">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7 reveal">
              <MatchCard
                title="Pembrolizumab + Chemotherapy in NSCLC"
                nct="NCT06118823"
                phase="Phase 2"
                score={87}
                rows={[
                  { label: "Age", you: "58", req: "18+", status: "match" },
                  { label: "Stage", you: "IIIA", req: "IIIA / IIIB", status: "match" },
                  { label: "ECOG Status", you: "1", req: "0 – 1", status: "match" },
                  { label: "Prior anti-PD-1", you: "None", req: "None", status: "match" },
                  { label: "Autoimmune", you: "—", req: "No active", status: "unknown" },
                  { label: "CNS metastases", you: "None", req: "None active", status: "match" },
                ] as MatchCardRow[]}
                dark
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ THREE STEPS ============ */}
      <section className="section-pad">
        <div className="max-w-wide mx-auto px-6">
          <div className="text-center mb-16">
            <p className="reveal eyebrow-sm mb-4">How It Works</p>
            <h2 className="scroll-words section-headline text-balance max-w-3xl mx-auto">
              Three minutes. Instant matches. No account.
            </h2>
          </div>

          <div className="reveal-batch grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Search, step: "01", title: "Enter your profile", desc: "Age, conditions, medications, lab values, location. Five quick sections. Everything stays in your browser.", bg: "bg-white" },
              { icon: Zap, step: "02", title: "Instant screening", desc: "Your profile runs against 65,081 pre-parsed trials in milliseconds. Deterministic, rule-based, reproducible.", bg: "bg-paper-alt" },
              { icon: Sparkles, step: "03", title: "See the reasons", desc: "Every criterion shown — match, excluded, unknown. No opaque scores. You see exactly what qualified you.", bg: "bg-white" },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-[22px] p-10 border border-line-soft`}>
                <div className="flex items-start justify-between mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-accent/8 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-accent" strokeWidth={2.25} />
                  </div>
                  <span className="text-[80px] font-semibold leading-none text-line tabular">{s.step}</span>
                </div>
                <h3 className="text-[24px] font-semibold mb-3 leading-tight">{s.title}</h3>
                <p className="text-[15px] text-fg-mute leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CONDITIONS GRID ============ */}
      <section className="section-pad bg-paper-alt">
        <div className="max-w-wide mx-auto px-6">
          <div className="mb-14">
            <p className="reveal eyebrow-sm mb-4">Browse by condition</p>
            <h2 className="reveal section-headline max-w-xl text-balance">
              Jump straight to what matters.
            </h2>
          </div>

          <div className="reveal-batch grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {FEATURED_CONDITIONS.map((cond) => {
              const Icon = conditionIcons[cond.icon] || Activity;
              return (
                <Link
                  key={cond.name}
                  href="/match"
                  className="group bg-white rounded-[18px] p-5 border border-line-soft hover:border-accent/30 transition-all hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 mb-4 rounded-xl bg-accent/8 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                    <Icon className="w-5 h-5 text-accent" strokeWidth={2.25} />
                  </div>
                  <p className="text-[15px] font-semibold mb-0.5">{cond.name}</p>
                  <p className="text-[12px] text-fg-faint tabular">
                    {cond.count.toLocaleString()} trials
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ FEATURE ROW ============ */}
      <section className="section-pad">
        <div className="max-w-apple mx-auto px-6">
          <div className="reveal-batch grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: Zap, title: "Instant", desc: "Results in milliseconds.\nNo waiting period." },
              { icon: Shield, title: "Private", desc: "Data never leaves your browser.\nNo accounts, no tracking." },
              { icon: Globe, title: "Free", desc: "Public ClinicalTrials.gov data.\nZero cost, forever." },
            ].map((f, i) => (
              <div key={i}>
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-accent/8 flex items-center justify-center">
                  <f.icon className="w-6 h-6 text-accent" strokeWidth={2.25} />
                </div>
                <h3 className="text-[22px] font-semibold mb-2">{f.title}</h3>
                <p className="text-[15px] text-fg-mute leading-relaxed whitespace-pre-line">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bridge: paper → dark */}
      <div className="h-24 bg-gradient-to-b from-paper to-dark" aria-hidden="true" />

      {/* ============ FINAL CTA ============ */}
      <section className="section-pad bg-dark text-white text-center">
        <div className="max-w-apple mx-auto px-6">
          <h2 className="scroll-words mega-headline mb-6 text-balance">
            Find your trial.
            <br />
            <span className="text-white/50">It takes three minutes.</span>
          </h2>
          <p className="reveal text-[19px] text-white/60 max-w-xl mx-auto mb-10 leading-snug">
            No account. No tracking. Your data never leaves your browser.
          </p>
          <div className="reveal flex items-center justify-center gap-6">
            <Link href="/match" className="btn-primary">
              Get Matched <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/about" className="btn-secondary text-accent-dark hover:text-white">
              How it works <ArrowRight className="w-4 h-4 arrow" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
