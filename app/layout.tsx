import type { Metadata, Viewport } from "next";
import "./globals.css";
import "reactflow/dist/style.css";
import PWAInstall from "@/components/PWAInstall";
import ClerkRootProvider from "@/components/ClerkRootProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

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
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        {/* Apply theme class synchronously before React hydrates to prevent flash and
            ensure ThemeProvider reads the correct initial state from the DOM. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
        <ThemeProvider>
          <ClerkRootProvider>
            {children}
            <PWAInstall />
          </ClerkRootProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
