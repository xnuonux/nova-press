import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // lunari design tokens (mining section 13)
        lunari: {
          "bg-deep": "var(--lunari-bg-deep)",
          "bg-surface": "var(--lunari-bg-surface)",
          "bg-elevated": "var(--lunari-bg-elevated)",
          "fg-primary": "var(--lunari-fg-primary)",
          "fg-muted": "var(--lunari-fg-muted)",
          "fg-subtle": "var(--lunari-fg-subtle)",
          border: "var(--lunari-border)",
        },
        // nova golden hour accent
        nova: {
          accent: "var(--nova-accent)",
          "accent-soft": "var(--nova-accent-soft)",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      spacing: {
        // 4px base rhythm enforced by lunari-design-tokens skill
      },
      typography: {
        DEFAULT: {
          css: {
            "max-width": "65ch",
            "line-height": "1.7",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
