"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";

interface AsyncSearchableSelectProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label: string;
  fetchOptions: (q: string) => Promise<{ name: string; count?: number }[]>;
  fallbackOptions?: string[];
}

export default function AsyncSearchableSelect({
  selected,
  onChange,
  placeholder = "Search...",
  label,
  fetchOptions,
  fallbackOptions = [],
}: AsyncSearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<{ name: string; count?: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 2) {
      setOptions(
        fallbackOptions
          .filter((o) => !selected.includes(o))
          .slice(0, 20)
          .map((name) => ({ name }))
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchOptions(query);
        setOptions(res.filter((o) => !selected.includes(o.name)).slice(0, 20));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, fetchOptions, fallbackOptions]);

  const pickOption = (name: string) => {
    onChange([...selected, name]);
    setQuery("");
    inputRef.current?.focus();
  };

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
        {loading && <Loader2 className="w-3.5 h-3.5 text-fg-faint animate-spin" />}
      </div>

      {isOpen && options.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 py-1 bg-white border border-line rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.name}
              onClick={() => pickOption(opt.name)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2 text-[14px] text-fg hover:bg-paper-alt transition-colors"
            >
              <span className="truncate">{opt.name}</span>
              {opt.count !== undefined && (
                <span className="text-[11px] text-fg-faint tabular flex-shrink-0">{opt.count.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && query && query.length >= 2 && !loading && options.length === 0 && (
        <div className="absolute z-50 w-full mt-1.5 py-3 bg-white border border-line rounded-xl text-center text-[13px] text-fg-faint">
          No matches for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
