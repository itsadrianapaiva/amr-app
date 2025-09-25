import Image, { type StaticImageData } from "next/image";
import Link from "next/link";

import logoYellowPng from "@/public/assets/logo-yellow.png";
import logoBwPng from "@/public/assets/logo-bw.png";

type LogoVariant = "nav" | "footer";
type LogoSizing = "auto" | "fixed";

type LogoProps = {
  width?: number;
  height?: number;
  /** If provided, wraps the image in a link. Leave undefined to render a plain <img>. */
  href?: string | null;
  alt?: string;
  src?: string | StaticImageData;
  className?: string;
  variant?: LogoVariant;
  sizing?: LogoSizing;
  priority?: boolean;
};

export default function Logo({
  width = 160,
  height = 48,
  href = undefined, // no default link (prevents nested anchors)
  alt = "AMR logo",
  src = logoYellowPng,
  className,
  variant = "nav",
  sizing = "auto",
  priority = false,
}: LogoProps) {
  const sizes = variant === "nav" ? "160px" : "(min-width:1280px) 400px, 60vw";

  // Always include w-auto h-auto on the <img> to satisfy Next's aspect-ratio guard.
  // Then add any caller classes.
  const classes = ["block select-none w-auto h-auto", className]
    .filter(Boolean)
    .join(" ");

  // Inline style defines our sizing mode:
  // - fixed: pixel width + height:auto (caller controls exact width)
  // - auto : width:auto + height:auto (intrinsic sizing)
  const style =
    sizing === "fixed"
      ? ({ width: `${width}px`, height: "auto" } as const)
      : ({ width: "auto", height: "auto" } as const);

  const img = (
    <Image
      src={src}
      width={width}
      height={height}
      alt={alt}
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      sizes={sizes}
      decoding="async"
      className={classes}
      draggable={false}
      style={style}
    />
  );

  return href ? (
    <Link
      href={href}
      prefetch={false}
      aria-label={alt || "Go to link"}
      className="inline-flex items-center"
    >
      {img}
    </Link>
  ) : (
    img
  );
}

export const AMR_LOGO_YELLOW = logoYellowPng as StaticImageData;
export const AMR_LOGO_BW = logoBwPng as StaticImageData;
