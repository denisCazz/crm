// app/robots.ts
export default function robots() {
  return {
    rules: [
      { userAgent: "*", disallow: ["/login", "/signup"] },
    ],
    sitemap: "https://bitora-crm.it/sitemap.xml",
  };
}
