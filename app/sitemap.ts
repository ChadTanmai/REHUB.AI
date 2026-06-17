import type { MetadataRoute } from "next";

const BASE = "https://rehub-ai.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, lastModified: new Date(), priority: 1 },
    { url: `${BASE}/for-facilities`, lastModified: new Date(), priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: new Date(), priority: 0.8 },
    { url: `${BASE}/demo`, lastModified: new Date(), priority: 0.8 },
    { url: `${BASE}/about`, lastModified: new Date(), priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: new Date(), priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: new Date(), priority: 0.4 },
    { url: `${BASE}/terms`, lastModified: new Date(), priority: 0.4 },
  ];
}
