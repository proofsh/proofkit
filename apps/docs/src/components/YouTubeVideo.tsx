interface YouTubeVideoProps {
  title: string;
  videoId?: string;
  url?: string;
}

function getYouTubeVideoId({ url, videoId }: Pick<YouTubeVideoProps, "url" | "videoId">): string {
  if (videoId) {
    return videoId;
  }

  if (!url) {
    throw new Error("YouTubeVideo requires either a url or videoId.");
  }

  const parsedUrl = new URL(url);

  if (parsedUrl.hostname === "youtu.be") {
    const idFromShortUrl = parsedUrl.pathname.slice(1);
    if (idFromShortUrl) {
      return idFromShortUrl;
    }
  }

  if (parsedUrl.pathname.startsWith("/embed/")) {
    const idFromEmbedPath = parsedUrl.pathname.split("/")[2];
    if (idFromEmbedPath) {
      return idFromEmbedPath;
    }
  }

  const idFromQuery = parsedUrl.searchParams.get("v");
  if (idFromQuery) {
    return idFromQuery;
  }

  throw new Error(`Unable to extract YouTube video ID from URL: ${parsedUrl.href}`);
}

export function YouTubeVideo(props: YouTubeVideoProps) {
  const videoId = getYouTubeVideoId(props);
  const src = `https://www.youtube-nocookie.com/embed/${videoId}`;

  return (
    <div className="my-6 overflow-hidden rounded-xl border bg-fd-card shadow-md">
      <div className="relative aspect-video">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
          referrerPolicy="strict-origin-when-cross-origin"
          src={src}
          title={props.title}
        />
      </div>
    </div>
  );
}
