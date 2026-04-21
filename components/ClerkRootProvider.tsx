"use client";

import { ClerkProvider } from "@clerk/nextjs";

interface ClerkRootProviderProps {
  children: React.ReactNode;
}

export default function ClerkRootProvider({ children }: ClerkRootProviderProps) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
