import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "reactflow/dist/style.css";
import PWAInstall from "@/components/PWAInstall";

export const metadata: Metadata = {
  title: "شجرة عائلات القرية",
  description: "توثيق واستعراض علاقات العائلات داخل القرية.",
  manifest: "/manifest.webmanifest",
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
    <ClerkProvider>
      <html lang="ar" dir="rtl">
        <body>
          {children}
          <PWAInstall />
        </body>
      </html>
    </ClerkProvider>
  );
}
