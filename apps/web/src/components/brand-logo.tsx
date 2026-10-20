import Image from "next/image";

type BrandLogoProps = {
  variant?: "horizontal" | "stacked" | "mark";
  className?: string;
  decorative?: boolean;
};

const assets = {
  horizontal: { src: "/brand/narayana-naturals-horizontal.svg", width: 394, height: 72 },
  stacked: { src: "/brand/narayana-naturals-logo.svg", width: 364, height: 230 },
  mark: { src: "/brand/narayana-naturals-mark.svg", width: 174, height: 162 },
};

export function BrandLogo({ variant = "horizontal", className = "", decorative = false }: BrandLogoProps) {
  const asset = assets[variant];
  return <Image {...asset} alt={decorative ? "" : "Narayana Naturals"} className={`brand-logo ${className}`} loading="eager" unoptimized />;
}
