/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true, // 開啟 App Router
  },
  // 明確指定 src 為根目錄
  //（可選，Next 14 起已內建支援 src/，但 Vercel 有時偵測不到）
  // 不需要特別寫 basePath unless 你 deploy 在子路徑
};

export default nextConfig;
