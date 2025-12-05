import Image from "next/image";
import type { StaticImageData } from "next/image";

/**
 * SafeImage: Environment-aware image component wrapper.
 *
 * On environments where NEXT_PUBLIC_DISABLE_OPTIMIZED_IMAGES=1 (e.g., staging),
 * this renders a plain <img> tag to bypass Next.js image optimization.
 * On all other environments (e.g., production), it uses Next.js <Image> normally.
 *
 * This allows us to work around Netlify staging image optimizer issues without
 * affecting production performance.
 */

type SafeImageProps = {
  src: string | StaticImageData;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  onClick?: () => void;
  style?: React.CSSProperties;
};

// Detect at build time whether to disable optimization
const disableOptimizedImages =
  process.env.NEXT_PUBLIC_DISABLE_OPTIMIZED_IMAGES === "1" ||
  process.env.NEXT_PUBLIC_DISABLE_OPTIMIZED_IMAGES?.toLowerCase() === "true";

// Normalize src to string URL
function getSrcUrl(src: string | StaticImageData): string {
  return typeof src === "string" ? src : src.src;
}

export default function SafeImage({
  src,
  alt,
  width,
  height,
  fill,
  className,
  sizes,
  priority,
  loading,
  onClick,
  style,
}: SafeImageProps) {
  if (disableOptimizedImages) {
    // Render plain <img> tag for staging
    const srcUrl = getSrcUrl(src);
    const loadingAttr = loading || (priority ? "eager" : "lazy");

    return (
      <img
        src={srcUrl}
        alt={alt}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        className={className}
        loading={loadingAttr}
        decoding="async"
        onClick={onClick}
        style={style}
      />
    );
  }

  // Render Next.js <Image> for production and other environments
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
      loading={loading}
      onClick={onClick}
      style={style}
    />
  );
}
