import type { Metadata } from "next";
import "@fontsource-variable/anek-telugu";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "@fontsource/noto-sans-telugu/400.css";
import "./globals.css";
import { PreviewProvider } from "@/components/preview-provider";

export const metadata: Metadata = {
  title: "Narayana Naturals | Traditional Ghani groundnut oil",
  description: "Explore traditional bull-driven wooden Ghani groundnut oil from Narayana Naturals. Choose your pack, check delivery and follow your order.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PreviewProvider>{children}</PreviewProvider></body></html>;
}
