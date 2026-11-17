import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101914",
        forest: "#173c2b",
        mint: "#dff6e8",
        paper: "#f6f8f5",
      },
      boxShadow: {
        soft: "0 16px 50px rgba(21, 48, 34, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
