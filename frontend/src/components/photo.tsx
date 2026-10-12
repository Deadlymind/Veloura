"use client";
import Image from "next/image";
import { useState } from "react";
import { Flower2 } from "lucide-react";
export function Photo({
  src,
  alt,
  sizes = "(max-width: 640px) 50vw, 25vw",
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div
        className={`photo-fallback ${className}`}
        role="img"
        aria-label={alt}
      >
        <Flower2 size={44} strokeWidth={1} />
        <span>Veloura</span>
      </div>
    );
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
      unoptimized={src.startsWith("/media/")}
    />
  );
}
