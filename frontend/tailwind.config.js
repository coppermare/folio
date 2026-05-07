/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        serif: ['"IBM Plex Serif"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        // iOS-inspired semantic radii. Use these names rather than the raw scale.
        control: '0.5rem',     // 8px  — pills, tabs, menu items, small buttons
        button: '0.75rem',     // 12px — default buttons
        card: '1rem',          // 16px — cards, dialogs, large buttons, popovers
        sheet: '1.25rem',      // 20px — sheets / large surfaces
      },
    },
  },
  plugins: [],
};
