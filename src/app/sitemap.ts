import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "/", lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: "/dashboard", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];
}
