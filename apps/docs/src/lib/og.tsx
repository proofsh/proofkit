import type { Metadata } from "next";
import { ImageResponse } from "next/og";

export const siteName = "ProofKit";
export const siteUrl = "https://proofkit.proof.sh";
export const defaultDescription =
  "Create modern web interfaces for FileMaker with AI agents, useful context, and a closed build/test/deploy loop.";

export const marketingPages = {
  home: {
    title: "Build like anything is possible again.",
    description: defaultDescription,
    path: "/",
    eyebrow: "ProofKit",
  },
  examples: {
    title: "What You Can Build",
    description: "Examples of modern web UI you can build for FileMaker with agentic coding and a modern web stack.",
    path: "/examples",
    eyebrow: "Examples",
  },
  "how-it-works": {
    title: "How ProofKit Works",
    description: "Agent-first architecture, from FileMaker schema to deployed Web Viewer app in a single session.",
    path: "/how-it-works",
    eyebrow: "How it works",
  },
  "why-webviewers": {
    title: "The Hybrid App Advantage",
    description:
      "Web UI in a FileMaker shell, with FileMaker still providing data, security, scripting, and infrastructure.",
    path: "/why-webviewers",
    eyebrow: "Why WebViewers",
  },
  "why-proofkit": {
    title: "Why ProofKit",
    description: "ProofKit is built for agents writing code with humans supervising.",
    path: "/why-proofkit",
    eyebrow: "Why ProofKit",
  },
} as const;

export type MarketingPageKey = keyof typeof marketingPages;

interface OgImageOptions {
  title: string;
  description?: string | null;
  eyebrow?: string;
}

export function getMarketingPageImage(page: MarketingPageKey) {
  return {
    url: `/og/marketing/${page}.png`,
    width: 1200,
    height: 630,
    alt: `${marketingPages[page].title} - ${siteName}`,
  };
}

export function getMarketingMetadata(page: MarketingPageKey): Metadata {
  const data = marketingPages[page];
  const image = getMarketingPageImage(page);

  return {
    title: data.title,
    description: data.description,
    alternates: {
      canonical: data.path,
    },
    openGraph: {
      title: data.title,
      description: data.description,
      type: "website",
      url: data.path,
      siteName,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.description,
      images: [image.url],
    },
  };
}

export function createOgImageResponse({ title, description, eyebrow = siteName }: OgImageOptions) {
  let titleSize = 74;
  if (title.length > 58) {
    titleSize = 54;
  } else if (title.length > 36) {
    titleSize = 62;
  }

  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        backgroundColor: "#020103",
        backgroundImage:
          "radial-gradient(circle at 22% -8%, rgba(209,90,187,0.78), transparent 35%), radial-gradient(circle at 82% 4%, rgba(137,35,107,0.7), transparent 32%), linear-gradient(180deg, #120611 0%, #020103 66%, #000000 100%)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, Arial, sans-serif",
        height: "100%",
        justifyContent: "space-between",
        overflow: "hidden",
        padding: "58px 70px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 24,
          display: "flex",
          height: 74,
          left: 62,
          position: "absolute",
          right: 62,
          top: 42,
        }}
      />

      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", zIndex: 1 }}>
        <div style={{ alignItems: "center", display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
          <span style={{ color: "#ff595e", marginRight: 8 }}>{">_"}</span>
          <span style={{ color: "#d15abb" }}>proofkit</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 21, fontWeight: 700 }}>{siteName}</div>
      </div>

      <div style={{ display: "flex", gap: 42, zIndex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <div
            style={{
              alignItems: "center",
              alignSelf: "flex-start",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.13)",
              borderRadius: 999,
              color: "rgba(255,255,255,0.66)",
              display: "flex",
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 26,
              padding: "9px 18px",
            }}
          >
            <span
              style={{
                background: "#ffffff",
                borderRadius: 999,
                color: "#050505",
                fontSize: 15,
                fontWeight: 900,
                marginRight: 12,
                padding: "5px 10px",
              }}
            >
              NEW
            </span>
            {eyebrow}
          </div>

          <div style={{ fontSize: titleSize, fontWeight: 900, letterSpacing: -3, lineHeight: 0.93 }}>{title}</div>

          {description ? (
            <div
              style={{
                color: "rgba(255,255,255,0.62)",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.35,
                marginTop: 28,
                maxWidth: 720,
              }}
            >
              {description}
            </div>
          ) : null}
        </div>

        <div
          style={{
            alignSelf: "flex-end",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 32,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            minWidth: 290,
            padding: 22,
          }}
        >
          {["AI Agent", "MCP Server", "FileMaker", "Web Viewer"].map((label, index) => (
            <div
              key={label}
              style={{
                alignItems: "center",
                background: index === 2 ? "rgba(209,90,187,0.22)" : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.11)",
                borderRadius: 18,
                color: index === 2 ? "#ffffff" : "rgba(255,255,255,0.7)",
                display: "flex",
                fontSize: 22,
                fontWeight: 800,
                justifyContent: "space-between",
                padding: "15px 18px",
              }}
            >
              {label}
              <span style={{ color: "rgba(255,255,255,0.34)" }}>{index < 3 ? ">" : ""}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          color: "rgba(255,255,255,0.34)",
          display: "flex",
          fontSize: 19,
          fontWeight: 800,
          justifyContent: "center",
          letterSpacing: 6,
          textTransform: "uppercase",
          zIndex: 1,
        }}
      >
        Built for the modern FileMaker stack
      </div>
    </div>,
    {
      height: 630,
      width: 1200,
    },
  );
}
