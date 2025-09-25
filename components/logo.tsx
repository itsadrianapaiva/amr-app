import Image, { type StaticImageData } from "next/image";
import Link from "next/link";

import logoYellowPng from "@/public/assets/logo-yellow.png";
import logoBwPng from "@/public/assets/logo-bw.png";

type LogoVariant = "nav" | "footer";
type LogoSizing = "auto" | "fixed";

type LogoProps = {
  width?: number;
  height?: number;
  href?: string;
  alt?: string;
  src?: string | StaticImageData;
  className?: string;
  variant?: LogoVariant;
  /** 
   * "auto"  => keep CSS width/height auto (good for header; avoids Next warning)
   * "fixed" => apply pixel width (lets callers control exact rendered size)
   */
  sizing?: LogoSizing;
  /** Allow callers to force priority when the logo is actually LCP (rare). */
  priority?: boolean;
};

export default function Logo({
  width = 160,
  height = 48,
  href = "/#home",
  alt = "AMR logo",
  src = logoYellowPng,
  className,
  variant = "nav",
  sizing = "auto",
  priority = false,
}: LogoProps) {
  const sizes =
    variant === "nav" ? "160px" : "(min-width:1280px) 400px, 60vw";

  const classes = ["block select-none", className].filter(Boolean).join(" ");

  // Apply width strategy:
  // - auto  : keep width/height auto to avoid Next warning in cases with Tailwind img reset
  // - fixed : use pixel width so parent can dial exact visual size (footer)
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
      aria-label="Go to home"
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
