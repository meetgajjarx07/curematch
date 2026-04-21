import type { Metadata } from "next";
import { MOCK_TRIALS } from "@/lib/mock-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trial = MOCK_TRIALS.find((t) => t.nctId === id);

  if (!trial) {
    return {
      title: "Trial Not Found — CureMatch",
      description: "No trial with that identifier.",
    };
  }

  return {
    title: `${trial.briefTitle} (${trial.nctId}) — CureMatch`,
    description: trial.briefSummary.slice(0, 160),
    openGraph: {
      title: trial.briefTitle,
      description: trial.briefSummary.slice(0, 200),
      type: "article",
    },
  };
}

export default function TrialLayout({ children }: { children: React.ReactNode }) {
  return children;
}
