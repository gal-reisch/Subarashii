import type { Metadata, Viewport } from "next";
import { Nunito, Poppins, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

// Nunito carries body copy — it's a rounded, friendly sans. Headlines,
// recipe titles, and field labels use Poppins (SemiBold 600 / Medium 500);
// numeric/stat values (calorie counts, times) use Geist Mono. Pairing per
// the user's Figma style guide (task #24).
const sans = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const heading = Poppins({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Subarashii",
  description: "Ella's recipe box — save, browse, and cook.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Subarashii",
  },
  // This Next.js version's `appleWebApp.capable` only emits the new
  // unprefixed `mobile-web-app-capable` meta tag (confirmed in
  // node_modules/next/dist/docs/.../generate-metadata.md — a deliberate
  // rename in this version, per the repo's "not the Next.js you know"
  // warning). iOS Safari doesn't read that unprefixed tag at all — it only
  // ever honors the legacy `apple-mobile-web-app-capable` one to suppress
  // the browser chrome on "Add to Home Screen." Without it, the installed
  // PWA renders inside Safari's normal toolbar instead of standalone. Add
  // it explicitly via `other` since the typed API in this version won't.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#fcfdf7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${heading.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        {/* Mounted once, at the root, because a toast raised on the recipe
            page has to outlive the navigation that a Server Action's
            revalidation can trigger underneath it. */}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
