import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — CureMatch",
  description:
    "A transparent, deterministic approach to clinical trial matching. Read the pipeline, the verdicts, and the limitations.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
