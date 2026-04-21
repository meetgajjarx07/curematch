"use client";

interface FigureNumberProps {
  n: string | number;
  label?: string;
  className?: string;
}

export default function FigureNumber({ n, label, className = "" }: FigureNumberProps) {
  const display = typeof n === "number"
    ? String(n).padStart(2, "0")
    : n;
  return (
    <span className={`figure-num ${className}`}>
      {label ? `${label}. ` : "§ "}{display}
    </span>
  );
}
