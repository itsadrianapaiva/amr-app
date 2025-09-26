// components/logo.tsx
import type { StaticImageData } from "next/image";
import Link from "next/link";

import logoYellowPng from "@/public/assets/logo-yellow.png";
import logoBwPng from "@/public/assets/logo-bw.png";

/** Variants: nav/mobile vs footer */
type LogoVariant = "nav" | "footer";
/** Sizing modes:
 * - "fixed": explicit pixel box (nav/mobile)
 * - "auto": responsive width with maxWidth cap (footer)
 */
type LogoSizing = "auto" | "fixed";

type LogoProps = {
  /** For nav/mobile ("fixed") this is the exact pixel width.
   *  For footer ("auto") this is the maxWidth cap in CSS pixels.
   */
  width?: number;
  /** Only used for "fixed". */
  height?: number;
  /** Optional explicit aspect ratio (width / height) when src is a string. */
  aspectRatio?: number;

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

/** Try to read intrinsic width/height from StaticImageData. */
function getIntrinsicSize(
  src?: string | StaticImageData
): { width: number; height: number } | null {
  if (!src || typeof src === "string") return null;
  const any = src as any;
  const w = typeof any.width === "number" ? any.width : undefined;
  const h = typeof any.height === "number" ? any.height : undefined;
  if (w && h) return { width: w, height: h };
  return null;
}

/** Compute the HTML width/height attributes we should output.
 *  These attributes help the browser reserve space and prevent layout shift,
 *  even when CSS later scales the image.
 */
function computeAttrDims(opts: {
  sizing: LogoSizing;
  width?: number;
  height?: number;
  intrinsic?: { width: number; height: number } | null;
  aspectRatio?: number;
}): { attrWidth: number | undefined; attrHeight: number | undefined } {
  const { sizing, width, height, intrinsic, aspectRatio } = opts;

  if (sizing === "fixed") {
    // Exact pixel box — attributes should mirror the CSS box.
    if (typeof width === "number" && typeof height === "number") {
      return { attrWidth: width, attrHeight: height };
    }
    // Fallback if height omitted: derive from intrinsic or aspect ratio.
    if (typeof width === "number") {
      if (intrinsic) {
        const h = Math.round((width * intrinsic.height) / intrinsic.width);
        return { attrWidth: width, attrHeight: h };
      }
      if (aspectRatio && aspectRatio > 0) {
        const h = Math.round(width / aspectRatio);
        return { attrWidth: width, attrHeight: h };
      }
    }
    // Last resort: a conservative 160x48 box to avoid zero dims.
    return { attrWidth: 160, attrHeight: 48 };
  }

  // sizing === "auto" (responsive). We still send attributes to encode aspect ratio.
  if (intrinsic) {
    return { attrWidth: intrinsic.width, attrHeight: intrinsic.height };
  }
  if (typeof width === "number" && aspectRatio && aspectRatio > 0) {
    const h = Math.round(width / aspectRatio);
    return { attrWidth: width, attrHeight: h };
  }
  // Safe default AR similar to current visual (≈3.33:1).
  return { attrWidth: 333, attrHeight: 100 };
}

export default function Logo({
  width = 160,
  height = 48,
  aspectRatio, // optional, only needed for string sources without intrinsic data
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

  // Intrinsic size if we have a static import.
  const intrinsic = getIntrinsicSize(src);

  // Compute HTML attributes to always provide width/height (prevents CLS).
  const { attrWidth, attrHeight } = computeAttrDims({
    sizing,
    width,
    height,
    intrinsic,
    aspectRatio,
  });

  // Wrapper controls layout and size. We NEVER absolutely position the image.
  const wrapperStyle: React.CSSProperties =
    sizing === "fixed"
      ? {
          width, // exact pixel width (nav/mobile)
          height, // exact pixel height (nav/mobile) — if caller omitted height,
                  // we still pass fallback attrs above to preserve AR.
          lineHeight: 0,
          display: "inline-block",
          position: "relative",
          zIndex: 1,
        }
      : {
          width: "100%", // footer: responsive width
          maxWidth: width, // cap (e.g., 320)
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
          height: "100%", // fill exact pixel box
          objectFit: "contain",
          display: "block",
        }
      : {
          width: "100%",
          height: "auto", // classic responsive image
          objectFit: "contain",
          display: "block",
        };

  const imgEl = (
    <span
      className={["select-none", className].filter(Boolean).join(" ")}
      style={wrapperStyle}
    >
      <img
        src={srcUrl}
        alt={alt}
        decoding="async"
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        // Always provide width/height attributes to encode aspect ratio.
        width={attrWidth}
        height={attrHeight}
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
