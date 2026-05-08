import Image from "next/image";
import { cn } from "../lib/cn";

interface ThemedImageProps {
  lightSrc: string;
  darkSrc: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

export function ThemedImage({ lightSrc, darkSrc, alt, width, height, className }: ThemedImageProps) {
  return (
    <>
      <Image
        alt={alt}
        className={cn("block border-0 bg-transparent dark:hidden", className)}
        height={height}
        src={lightSrc}
        width={width}
      />
      <Image
        alt={alt}
        className={cn("hidden border-0 bg-transparent dark:block", className)}
        height={height}
        src={darkSrc}
        width={width}
      />
    </>
  );
}
