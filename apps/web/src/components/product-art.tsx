import type { PackId } from "@/lib/demo";

// A deliberately flat packaging concept, not a photograph of the real product.
export function ProductArt({ pack = "1l", className = "" }: { pack?: PackId; className?: string }) {
  const large = pack === "5l";
  return <svg className={`product-art ${className}`} viewBox="0 0 260 340" role="img" aria-label={`Narayana Naturals ${pack.replace("l", " litre")} packaging concept`}>
    <ellipse cx="130" cy="309" rx={large ? 91 : 66} ry="9" fill="#183A28" opacity="0.08" />
    {large ? <>
      <path d="M58 59h96l46 45v182a16 16 0 0 1-16 16H56a16 16 0 0 1-16-16V89a30 30 0 0 1 18-30Z" fill="#D9A52C" />
      <path d="M155 58h23l33 33v55h-15v-42l-25-24h-16Z" fill="#183A28" />
      <rect x="58" y="42" width="55" height="26" rx="5" fill="#183A28" />
    </> : <>
      <path d="M105 47h50v40l26 27v174a15 15 0 0 1-15 15H94a15 15 0 0 1-15-15V114l26-27Z" fill="#D9A52C" />
      <rect x="99" y="32" width="62" height="24" rx="5" fill="#183A28" />
      <path d="M91 119v163" stroke="#F1CE6D" strokeWidth="5" strokeLinecap="round" />
    </>}
    <rect x={large ? 51 : 86} y="143" width={large ? 138 : 88} height="116" rx="2" fill="#F3F6EC" />
    <image href="/brand/narayana-naturals-logo.svg" x={large ? 69 : 89} y="151" width={large ? 122 : 82} height="57" aria-hidden="true" />
    <path d="M111 214h38" stroke="#D9A52C" />
    <text x="130" y="229" textAnchor="middle" fill="#183A28" fontFamily="'Source Sans 3', sans-serif" fontSize="8">GHANI GROUNDNUT OIL</text>
    <text x="130" y="249" textAnchor="middle" fill="#183A28" fontFamily="'Source Sans 3', sans-serif" fontSize="14" fontWeight="600">{pack.replace("l", " L")}</text>
  </svg>;
}
