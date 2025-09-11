import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  width?: number;
  height?: number;
  href?: string;
  alt?: string;
  src?: string;
  className?: string;
};

/**
 * Logo
 * - Keeps explicit intrinsic width/height for stable layout.
 * - Forces CSS `width:auto` & `height:auto` to avoid Next.js "one dimension modified" warning,
 *   which can be triggered by Tailwind's img reset (height:auto).
 */
export default function Logo({
  width = 120,
  height = 40,
  href = "/#home",
  alt = "AMR logo",
  src = "/assets/logo-yellow.png",
  className,
}: LogoProps) {
  const classes = ["block select-none", className].filter(Boolean).join(" ");

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
        className={classes}
        draggable={false}
        // Critical: ensure both dimensions are "auto" at CSS level
        // so Tailwind's img reset doesn't trip Next's warning.
        style={{ width: "auto", height: "auto" }}
      />
    </Link>
  );
}
