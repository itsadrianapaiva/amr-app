// components/logo.tsx
import type { StaticImageData } from "next/image";
import Link from "next/link";

import logoYellowPng from "@/public/assets/logo-yellow.png";
import logoBwPng from "@/public/assets/logo-bw.png";

type LogoVariant = "nav" | "footer";
type LogoSizing = "auto" | "fixed";

type LogoProps = {
  /** For nav/mobile ("fixed"): exact pixel box. For footer ("auto"): maxWidth cap. */
  width?: number;
  /** Only used for "fixed" (nav/mobile). Ignored for footer ("auto"). */
  height?: number;
  href?: string | null;
  alt?: string;
  /** Accepts static import or string path. */
  src?: string | StaticImageData;
  className?: string;
  variant?: LogoVariant;
  sizing?: LogoSizing;
  /** When true, set loading="eager". */
  priority?: boolean;
};

export default function Logo({
  width = 160,
  height = 48,
  href,
  alt = "AMR logo",
  src = logoYellowPng,
  className,
  variant = "nav",
  sizing = "auto",
  priority = false,
}: LogoProps) {
  // Resolve actual URL from StaticImageData or string.
  const srcUrl = typeof src === "string" ? src : (src as StaticImageData).src;

  // Wrapper controls layout and size. We NEVER absolutely position the image.
  const wrapperStyle: React.CSSProperties =
    sizing === "fixed"
      ? {
          width,            // exact pixel width (nav/mobile)
          height,           // exact pixel height (nav/mobile)
          lineHeight: 0,    // remove baseline whitespace that can "squeeze" visuals
          display: "inline-block",
          position: "relative",
          zIndex: 1,        // ensure it sits above backgrounds/letters
        }
      : {
          width: "100%",    // footer: responsive width
          maxWidth: width,  // cap (e.g., 320)
          lineHeight: 0,
          display: "inline-block",
          position: "relative",
          zIndex: 1,
        };

  // The <img> fills the wrapper. For "fixed", that means exact pixels.
  // For "auto", it scales with width while preserving aspect via height:auto.
  const imgStyle: React.CSSProperties =
    sizing === "fixed"
      ? {
          width: "100%",
          height: "100%",   // fill exact pixel box
          objectFit: "contain",
          display: "block",
        }
      : {
          width: "100%",
          height: "auto",   // classic responsive image
          objectFit: "contain",
          display: "block",
        };

  const imgEl = (
    <span className={["select-none", className].filter(Boolean).join(" ")} style={wrapperStyle}>
      <img
        src={srcUrl}
        alt={alt}
        decoding="async"
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        // width/height attributes help reserve space (esp. in "fixed").
        // They don't fight our CSS because CSS uses percentages (and height:auto in footer).
        width={sizing === "fixed" ? width : undefined}
        height={sizing === "fixed" ? height : undefined}
        style={imgStyle}
      />
    </span>
  );

  return href ? (
    <Link href={href} aria-label={alt} className="inline-flex items-center">
      {imgEl}
    </Link>
  ) : (
    imgEl
  );
}

export const AMR_LOGO_YELLOW = logoYellowPng as StaticImageData;
export const AMR_LOGO_BW = logoBwPng as StaticImageData;
