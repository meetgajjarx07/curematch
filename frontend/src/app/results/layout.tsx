import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Matches — CureMatch",
  description:
    "Ranked clinical trial matches for your profile. See every criterion evaluated — match, excluded, unknown.",
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
