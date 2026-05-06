import { notFound } from "next/navigation";
import { createOgImageResponse, marketingPages } from "@/lib/og";

export const revalidate = false;

const PNG_EXTENSION = /\.png$/;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pageKey = slug.replace(PNG_EXTENSION, "") as keyof typeof marketingPages;
  const page = marketingPages[pageKey];

  if (!page) {
    notFound();
  }

  return createOgImageResponse({
    title: page.title,
    description: page.description,
    eyebrow: page.eyebrow,
  });
}

export function generateStaticParams() {
  return Object.keys(marketingPages).map((slug) => ({
    slug: `${slug}.png`,
  }));
}
