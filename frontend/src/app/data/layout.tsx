import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Corpus — CureMatch",
  description: "Live statistics from the ClinicalTrials.gov corpus CureMatch indexes: phase distribution, top conditions, parser coverage, and the data the agent is grounded in.",
};

export default function DataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
