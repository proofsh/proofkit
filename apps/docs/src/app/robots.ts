import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/llms.txt", "/llms-full.txt", "/llms/"],
    },
    sitemap: "https://proofkit.proof.sh/sitemap.xml",
  };
}
