import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  width?: number;
  height?: number;
  href?: string;
  alt?: string;
  src?: string;
};

/**
 * Logo
 * Minimal, LCP-friendly branded logo wrapper.
 * - Uses next/image with explicit width & height for stable layout.
 * - Keeps link + alt text accessible.
 * - `src` is customizable, defaulting to the confirmed yellow asset path.
 */
export default function Logo({
  width = 120,
  height = 40,
  href = "/#home",
  alt = "AMR logo",
  src = "/assets/logo-yellow.png",
}: LogoProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label="Go to home"
      className="inline-flex items-center"
    >
      <Image
        src={src}
        width={width}
        height={height}
        alt={alt}
        priority
        className="block select-none"
        draggable={false}
        sizes={`${width}px`}
      />
    </Link>
  );
}
