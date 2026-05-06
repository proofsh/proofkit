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
    return parsedUrl.pathname.slice(1);
  }

  if (parsedUrl.pathname.startsWith("/embed/")) {
    return parsedUrl.pathname.split("/")[2] ?? "";
  }

  return parsedUrl.searchParams.get("v") ?? "";
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
