import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "reactflow/dist/style.css";

export const metadata: Metadata = {
  title: "شجرة عائلات القرية",
  description: "توثيق واستعراض علاقات العائلات داخل القرية.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
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
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
