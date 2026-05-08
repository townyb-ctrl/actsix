import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        heading: [
          "Satoshi",
          "Inter Tight",
          "General Sans",
          "Manrope",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        body: ["Manrope", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Manrope", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "gradient-content": "var(--gradient-content)",
        "gradient-sidebar": "var(--gradient-sidebar)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        soft: "var(--shadow-soft)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        brand: {
          charcoal: "hsl(var(--brand-charcoal))",
          "warm-white": "hsl(var(--brand-warm-white))",
          teal: "hsl(var(--brand-teal))",
          "teal-dark": "hsl(var(--brand-teal-dark))",
          "teal-soft": "hsl(var(--brand-teal-soft))",
          sage: "hsl(var(--brand-sage))",
          "sage-soft": "hsl(var(--brand-sage-soft))",
          sand: "hsl(var(--brand-sand))",
          bronze: "hsl(var(--brand-bronze))",
          success: "hsl(var(--brand-success))",
          warning: "hsl(var(--brand-warning))",
          danger: "hsl(var(--brand-danger))",

          /* Existing aliases used in components */
          cream: "hsl(var(--brand-cream))",
          ink: "hsl(var(--brand-ink))",
          "teal-bright": "hsl(var(--brand-teal-bright))",
          amber: "hsl(var(--brand-amber))",
          coral: "hsl(var(--brand-coral))",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-xl)",
        full: "var(--radius-pill)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.16s ease-out",
        "accordion-up": "accordion-up 0.16s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
