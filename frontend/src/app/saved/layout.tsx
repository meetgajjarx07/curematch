import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Trials — CureMatch",
  description: "Your saved clinical trials. Stored in this browser, no account required.",
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
