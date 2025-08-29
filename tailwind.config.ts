import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],

  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem", // Default padding
        sm: "2rem", // Padding on screens `sm` and up
        lg: "4rem", // Padding on screens `lg` and up
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      // keep your other theme extensions here
    },
  },
  plugins: [],
} satisfies Config;
