import type { MetadataRoute } from "next";
import { source } from "@/lib/source";

const BASE_URL = "https://proofkit.proof.sh";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages().map((page) => ({
    url: `${BASE_URL}${page.url}`,
    lastModified: new Date(),
  }));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/llms.txt`, lastModified: new Date() },
    { url: `${BASE_URL}/llms-full.txt`, lastModified: new Date() },
  ];

  return [...pages, ...staticRoutes];
}
