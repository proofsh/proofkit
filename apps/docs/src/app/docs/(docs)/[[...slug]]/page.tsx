import { createRelativeLink } from "fumadocs-ui/mdx";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { siteName } from "@/lib/og";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const { body: MDXContent, toc } = await page.data.load();
  const githubUrl = `https://github.com/proofsh/proofkit/blob/main/apps/docs/content/docs/${page.path}`;
  const markdownUrl = `${page.url}.mdx`;

  return (
    <DocsPage
      editOnGithub={{
        owner: "proofsh",
        repo: "proofkit",
        path: `apps/docs/content/docs/${page.path}`,
        sha: "main",
      }}
      full={page.data.full}
      toc={toc}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pt-2 pb-6">
        <LLMCopyButton markdownUrl={markdownUrl} />
        <ViewOptions githubUrl={githubUrl} markdownUrl={markdownUrl} />
      </div>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            // biome-ignore lint/suspicious/noExplicitAny: fumadocs type compatibility issue
            a: createRelativeLink(source as any, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const url = `https://proofkit.proof.sh${page.url}`;
  const image = getPageImage(page).url;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: page.url,
    },
    openGraph: {
      title: page.data.title,
      description: page.data.description ?? undefined,
      type: "article",
      url,
      siteName,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${page.data.title} - ${siteName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description ?? undefined,
      images: [image],
    },
  };
}
