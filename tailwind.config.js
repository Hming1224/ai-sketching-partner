/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    // 確保這裡包含了所有使用 Tailwind CSS 的檔案路徑
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // 明確列出所有可能用到的動態顏色類別，確保 Tailwind 能夠找到它們
    {
      pattern:
        /(bg|border|text)-(blue|purple|green|orange)-(50|100|400|500|700)/,
    },
    "border-blue-500",
    "border-purple-500",
    "border-green-500",
    "border-orange-500",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
