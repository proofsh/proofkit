interface YouTubeVideoProps {
  title: string;
  videoId?: string;
  url?: string;
  /**
   * Full iframe `src` (e.g. built during a click handler with `getYouTubeNocookieEmbedSrc`).
   * When set, `url`, `videoId`, and `autoPlay` are ignored.
   */
  embedSrc?: string;
  /** Append `autoplay`, `playsinline`, and `origin` to the embed URL. */
  autoPlay?: boolean;
  /** Inline embed only (no docs card chrome). */
  variant?: "card" | "plain";
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function validateYouTubeVideoId(videoId: string, source: string): string {
  if (YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
    return videoId;
  }

  throw new Error(`Invalid YouTube video ID from ${source}: ${videoId}`);
}

function getYouTubeVideoId({ url, videoId }: Pick<YouTubeVideoProps, "url" | "videoId">): string {
  if (videoId) {
    return validateYouTubeVideoId(videoId, "videoId");
  }

  if (!url) {
    throw new Error("YouTubeVideo requires either a url or videoId.");
  }

  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.toLowerCase();

  if (!YOUTUBE_HOSTS.has(hostname)) {
    throw new Error(`Unsupported YouTube URL host: ${parsedUrl.hostname}`);
  }

  if (hostname === "youtu.be") {
    const idFromShortUrl = parsedUrl.pathname.split("/").filter(Boolean)[0];
    if (idFromShortUrl) {
      return validateYouTubeVideoId(idFromShortUrl, parsedUrl.href);
    }
  }

  if (parsedUrl.pathname.startsWith("/embed/")) {
    const idFromEmbedPath = parsedUrl.pathname.split("/")[2];
    if (idFromEmbedPath) {
      return validateYouTubeVideoId(idFromEmbedPath, parsedUrl.href);
    }
  }

  const idFromQuery = parsedUrl.searchParams.get("v");
  if (idFromQuery) {
    return validateYouTubeVideoId(idFromQuery, parsedUrl.href);
  }

  throw new Error(`Unable to extract YouTube video ID from URL: ${parsedUrl.href}`);
}

export interface YouTubeEmbedSrcArgs {
  url?: string;
  videoId?: string;
  autoPlay?: boolean;
  /** Register the embedding origin with YouTube (recommended with autoplay). */
  origin?: string;
}

export function getYouTubeNocookieEmbedSrc(args: YouTubeEmbedSrcArgs): string {
  const videoId = getYouTubeVideoId(args);
  const embedParams = new URLSearchParams();
  if (args.autoPlay) {
    embedParams.set("autoplay", "1");
    embedParams.set("playsinline", "1");
  }
  if (args.origin) {
    embedParams.set("origin", args.origin);
  }
  const qs = embedParams.toString();
  return qs
    ? `https://www.youtube-nocookie.com/embed/${videoId}?${qs}`
    : `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function YouTubeVideo(props: YouTubeVideoProps) {
  const { variant = "card", title, autoPlay = false, embedSrc: embedSrcProp } = props;
  const src =
    embedSrcProp ??
    getYouTubeNocookieEmbedSrc({
      url: props.url,
      videoId: props.videoId,
      autoPlay,
      origin: autoPlay && typeof window !== "undefined" ? window.location.origin : undefined,
    });

  const embed = (
    <div className="relative aspect-video">
      <iframe
        allow="accelerometer; autoplay *; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
        referrerPolicy="strict-origin-when-cross-origin"
        src={src}
        title={title}
      />
    </div>
  );

  if (variant === "plain") {
    return embed;
  }

  return <div className="my-6 overflow-hidden rounded-xl border bg-fd-card shadow-md">{embed}</div>;
}
