import Image, { type StaticImageData } from "next/image";
import Link from "next/link";

import logoYellowPng from "@/public/assets/logo-yellow.png";
import logoBwPng from "@/public/assets/logo-bw.png";

type LogoVariant = "nav" | "footer";
type LogoSizing = "auto" | "fixed";

type LogoProps = {
  width?: number;   // used only when sizing="fixed"
  height?: number;  // used only to compute aspect when sizing="fixed"
  href?: string | null;
  alt?: string;
  src?: string | StaticImageData;
  className?: string;   // applied to outer wrapper for both modes
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

  // --- fixed mode: wrapper + fill to avoid "width or height modified" warning ---
  if (sizing === "fixed") {
    // derive aspect from static import if available; else from provided width/height
    const intrinsicW =
      typeof src === "object" && "width" in src ? (src as StaticImageData).width : undefined;
    const intrinsicH =
      typeof src === "object" && "height" in src ? (src as StaticImageData).height : undefined;
    const aspect = (intrinsicW && intrinsicH ? intrinsicW / intrinsicH : width / Math.max(height, 1)) || 1;

    const wrapper = (
      <span
        className={["block select-none", className].filter(Boolean).join(" ")}
        style={{
          position: "relative",
          inlineSize: `${width}px`,         // keep your exact visual width
          aspectRatio: String(aspect),      // height derives coherently — no one-sided resize
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          decoding="async"
          draggable={false}
          style={{ objectFit: "contain" }}  // preserve proportions inside the box
        />
      </span>
    );

    return href ? (
      <Link href={href} prefetch={false} aria-label={alt || "Go to link"} className="inline-flex items-center">
        {wrapper}
      </Link>
    ) : (
      wrapper
    );
  }

  // --- auto mode: keep your previous behavior exactly ---
  const img = (
    <Image
      src={src}
      width={width}
      height={height}
      alt={alt}
      priority={priority}
      sizes={sizes}
      decoding="async"
      className={["block select-none w-auto h-auto", className].filter(Boolean).join(" ")}
      draggable={false}
      style={{
        width: "auto",
        height: "auto",
        maxWidth: "100%",
        maxHeight: "100%",
      }}
    />
  );

  return href ? (
    <Link href={href} prefetch={false} aria-label={alt || "Go to link"} className="inline-flex items-center">
      {img}
    </Link>
  ) : (
    img
  );
}

export const AMR_LOGO_YELLOW = logoYellowPng as StaticImageData;
export const AMR_LOGO_BW = logoBwPng as StaticImageData;
