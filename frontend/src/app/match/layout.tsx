import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build Your Profile — CureMatch",
  description:
    "Enter your age, conditions, medications, lab values, and location. Five quick steps. Your data stays in your browser.",
};

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
