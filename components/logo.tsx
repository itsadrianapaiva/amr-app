// components/logo.tsx
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";

import logoYellowPng from "@/public/assets/logo-yellow.png";
import logoBwPng from "@/public/assets/logo-bw.png";

type LogoVariant = "nav" | "footer";
type LogoSizing = "auto" | "fixed";

type LogoProps = {
  width?: number;
  height?: number;
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
  href = undefined,
  alt = "AMR logo",
  src = logoYellowPng,
  className,
  variant = "nav",
  sizing = "auto",
  priority = false,
}: LogoProps) {
  const sizes = variant === "nav" ? "160px" : "(min-width:1280px) 400px, 60vw";

  // NOTE: remove w-auto / h-auto so CSS classes don't fight our inline sizing.
  // Next's warning is often triggered when class-based width/height differs from inline.
  const classes = ["block select-none", className].filter(Boolean).join(" ");

  // Inline styles ALWAYS set BOTH width and height to keep aspect guard happy.
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
      draggable={false}
      className={classes}
      style={style}
    />
  );

  return href ? (
    <Link href={href} aria-label={alt || "Go to link"} className="inline-flex items-center">
      {img}
    </Link>
  ) : (
    img
  );
}

export const AMR_LOGO_YELLOW = logoYellowPng as StaticImageData;
export const AMR_LOGO_BW = logoBwPng as StaticImageData;
