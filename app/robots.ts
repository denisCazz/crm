// app/robots.ts
export default function robots() {
  return {
    rules: [
      { userAgent: "*", disallow: ["/login", "/signup"] },
    ],
    sitemap: "https://crm-3xm8.vercel.app/sitemap.xml",
  };
}
