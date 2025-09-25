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

  // Classes:
  // - Always keep h-auto to preserve aspect ratio.
  // - For nav/mobile we keep w-auto (current look stays unchanged).
  // - For footer we *don't* force w-auto; width is controlled via inline style (see below).
  const classes = [
    "block select-none h-auto",
    variant !== "footer" ? "w-auto" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Style:
  // - nav/mobile (sizing="fixed"): exact pixel width, height:auto (keeps your current look).
  // - footer (sizing="fixed"): width:100% so it grows to the container, but capped by maxWidth=<width>px.
  //   This restores the previous “adjust to container up to 320px” behavior and fixes the tiny footer logo.
  // - "auto": width:auto + height:auto (unchanged).
  const style: React.CSSProperties =
    sizing === "fixed"
      ? variant === "footer"
        ? {
            width: "100%",
            maxWidth: `${width}px`,
            height: "auto",
          }
        : {
            width: `${width}px`,
            height: "auto",
          }
      : {
          width: "auto",
          height: "auto",
          maxWidth: "100%",
          maxHeight: "100%",
        };

  const img = (
    <Image
      src={src}
      width={width}
      height={height}
      alt={alt}
      priority={priority}
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
      // keep clean navigation decisions outside this component
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
