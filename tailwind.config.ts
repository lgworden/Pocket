import type { Config } from "tailwindcss";

// "Clean girl" system: warm neutrals, one quiet accent, soft rounded shapes.
// Token names kept stable from the prior brand pass so component classes
// didn't need to change — only the hex values and shapes moved.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FBF8F3",  // ivory base background
        panel: "#F3ECE1",  // warm taupe-cream, card surfaces
        blue: "#AD8A64",   // caramel — the one accent (was primary blue)
        brown: "#7A5C3E",  // deep caramel, secondary dark accent
        pink: "#EADFCF",   // soft blush/oat highlight
        rose: "#B97A66",   // muted terracotta — errors / secondary accent
        ink: "#2E2924",    // espresso, primary text
        slate: "#8F8577",  // warm stone, muted text / borders
      },
      fontFamily: {
        display: ["Georgia", "'Iowan Old Style'", "serif"], // quiet italic accents only
        ui: ["Inter", "sans-serif"],                          // everything else, incl. headlines
      },
      // Soft, diffused depth instead of hard-offset shadows; corners are rounded everywhere.
      boxShadow: {
        soft: "0 20px 40px -18px rgba(46,41,36,0.20), 0 2px 6px rgba(46,41,36,0.06)",
        "soft-sm": "0 10px 24px -14px rgba(46,41,36,0.18), 0 1px 3px rgba(46,41,36,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
