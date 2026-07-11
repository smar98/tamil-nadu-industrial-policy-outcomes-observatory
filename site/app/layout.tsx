import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "Tamil Nadu Industrial Policy Outcomes Observatory",
    description: "An evidence-led audit of Tamil Nadu's industrial policy commitments and outcomes.",
    openGraph: {
      type: "website",
      title: "Tamil Nadu Industrial Policy Outcomes Observatory",
      description: "33 policies. 41 commitments. What public evidence can prove.",
      images: [{ url: new URL("/og.png", metadataBase).toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Tamil Nadu Industrial Policy Outcomes Observatory",
      description: "33 policies. 41 commitments. What public evidence can prove.",
      images: [new URL("/og.png", metadataBase).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
