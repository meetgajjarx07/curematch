import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--bg)",
        "paper-alt": "var(--bg-alt)",
        dark: "var(--bg-dark)",
        deep: "var(--bg-deep)",
        darker: "var(--bg-darker)",
        fg: {
          DEFAULT: "var(--fg)",
          soft: "var(--fg-soft)",
          mute: "var(--fg-mute)",
          faint: "var(--fg-faint)",
        },
        line: "var(--border)",
        "line-soft": "var(--border-soft)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-dark": "var(--accent-dark)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
        cosmic: {
          cyan: "var(--cosmic-cyan)",
          magenta: "var(--cosmic-magenta)",
          green: "var(--cosmic-green)",
          amber: "var(--cosmic-amber)",
        },
      },
      fontFamily: {
        sans: [
          "SF Pro Display",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "22px",
        "4xl": "28px",
      },
      maxWidth: {
        apple: "1024px",
        wide: "1440px",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
    },
  },
  plugins: [],
};
export default config;
