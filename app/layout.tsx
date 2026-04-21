import type { Metadata } from "next";
import "./globals.css";
import "reactflow/dist/style.css";
import PWAInstall from "@/components/PWAInstall";
import ClerkRootProvider from "@/components/ClerkRootProvider";

export const metadata: Metadata = {
  title: "شجرة عائلات القرية",
  description: "توثيق واستعراض علاقات العائلات داخل القرية.",
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "شجرة العائلات",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ClerkRootProvider>
          {children}
          <PWAInstall />
        </ClerkRootProvider>
      </body>
    </html>
  );
}
