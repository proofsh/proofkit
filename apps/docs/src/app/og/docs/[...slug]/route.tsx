import { notFound } from "next/navigation";
import { createOgImageResponse } from "@/lib/og";
import { getPageImage, source } from "@/lib/source";

export const revalidate = false;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));

  if (!page) {
    notFound();
  }

  return createOgImageResponse({
    title: page.data.title,
    description: page.data.description,
    eyebrow: "ProofKit Docs",
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: getPageImage(page).segments,
  }));
}
