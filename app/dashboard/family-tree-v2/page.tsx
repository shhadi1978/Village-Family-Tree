"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const fullScreenStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8fafc',
  zIndex: 9999
}

const FamilyTreeCanvas = dynamic(
  () => import("@/components/family-tree/FamilyTreeCanvas"),
  { 
    ssr: false, 
    loading: () => (
      <div style={fullScreenStyle}>
        <p style={{ fontSize: 18, color: '#64748b' }}>⏳ טוען...</p>
      </div>
    )
  }
);

type PermissionsResponse = {
  data?: {
    villageId?: string | null;
    user?: {
      villageId?: string | null;
    };
  };
  villageId?: string | null;
};

export default function FamilyTreePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [villageId, setVillageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPermissions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/me/permissions");
        if (!response.ok) {
          throw new Error("Failed to load permissions");
        }
        const result = (await response.json()) as PermissionsResponse;
        const extractedVillageId =
          result.data?.villageId || 
          result.data?.user?.villageId || 
          result.villageId || 
          null;
        if (isMounted) {
          setVillageId(extractedVillageId);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setVillageId(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPermissions();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div style={fullScreenStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48,
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #64748b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: '#475569', fontSize: 16 }}>טוען עץ משפחה...</p>
        </div>
      </div>
    );
  }

  if (error || !villageId) {
    return (
      <div style={fullScreenStyle} dir="rtl">
        <div style={{
          border: '1px solid #fecaca',
          background: '#fff1f2',
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          textAlign: 'center'
        }}>
          <p style={{ color: '#b91c1c', fontWeight: 'bold', fontSize: 18 }}>
            ❌ שגיאה בטעינת העץ
          </p>
          <p style={{ color: '#dc2626', fontSize: 14, marginTop: 8 }}>
            {error || "לא נמצא מזהה כפר עבור המשתמש"}
          </p>
          <Link 
            href="/dashboard" 
            style={{ 
              display: 'inline-block', 
              marginTop: 16, 
              color: '#2563eb', 
              fontSize: 14 
            }}
          >
            חזרה לדשבורד
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={fullScreenStyle}>
      <FamilyTreeCanvas villageId={villageId} />
    </div>
  );
}