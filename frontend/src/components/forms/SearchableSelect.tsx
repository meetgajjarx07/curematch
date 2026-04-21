"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search } from "lucide-react";

interface SearchableSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label: string;
}

export default function SearchableSelect({
  options,
  selected,
  onChange,
  placeholder = "Search...",
  label,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter(
    (opt) => opt.toLowerCase().includes(query.toLowerCase()) && !selected.includes(opt)
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[13px] font-medium text-fg-mute mb-2">{label}</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[13px] bg-accent/10 text-accent rounded-full"
            >
              {item}
              <button
                onClick={() => onChange(selected.filter((s) => s !== item))}
                className="hover:text-accent-hover transition-colors"
                aria-label={`Remove ${item}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className={`flex items-center gap-2.5 px-4 py-3 bg-white border rounded-xl transition-all cursor-text ${
          isOpen ? "border-accent ring-2 ring-accent/20" : "border-line"
        }`}
        onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
      >
        <Search className="w-4 h-4 text-fg-faint flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[15px] outline-none"
          aria-label={label}
        />
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 py-1 bg-white border border-line rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {filtered.slice(0, 20).map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange([...selected, opt]); setQuery(""); inputRef.current?.focus(); }}
              className="w-full text-left px-4 py-2 text-[14px] text-fg hover:bg-paper-alt transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {isOpen && query && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1.5 py-3 bg-white border border-line rounded-xl text-center text-[13px] text-fg-faint">
          No matches for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
