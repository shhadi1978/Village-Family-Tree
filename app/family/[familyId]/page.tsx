"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFamilies, useMembers } from "@/lib/hooks/use-api";
import { formatNumberAr, genderLabelAr } from "@/lib/i18n/format";
import { getMemberDisplayName } from "@/lib/member-display";
import { isFamilyFounder } from "@/lib/member-founder";
import { sortMembersByLineage } from "@/lib/member-lineage-sort";
import dynamic from "next/dynamic";
import { ArrowLeft, Home, ChevronUp, ChevronDown, Users } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";

type MemberSortMode = "SEQUENCE" | "ALPHABETICAL" | "LINEAGE";
type TreeViewMode = "FULL_FAMILY" | "PERSON_DESCENDANTS";

const FamilyTreeVisualization = dynamic(
  () => import("@/components/FamilyTreeVisualization"),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #334155', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>جاري تحميل الشجرة...</p>
        </div>
      </div>
    )
  }
);

export default function FamilyTreePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-slate-400 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>جاري تحميل شجرة العائلة...</p>
          </div>
        </div>
      }
    >
      <FamilyTreePageContent />
    </Suspense>
  );
}

function FamilyTreePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const familyId = params.familyId as string;
  const startMemberId = searchParams.get("member");
  const preferredFocusMemberId = "cmnhfo1xp006nfja84xhptcxo";

  const { getFamily } = useFamilies();
  const { getMembers } = useMembers();

  const [family, setFamily] = useState<any | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(startMemberId);
  const [treeViewMode, setTreeViewMode] = useState<TreeViewMode>(
    startMemberId ? "PERSON_DESCENDANTS" : "FULL_FAMILY"
  );
  const [treeData, setTreeData] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [memberSortMode, setMemberSortMode] = useState<MemberSortMode>("SEQUENCE");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treeReloadTick, setTreeReloadTick] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const treeCacheRef = useRef<Record<string, any>>({});
  const lastHandledReloadTickRef = useRef(0);

  const sortedMembers = useMemo(() => {
    const list = Array.isArray(members) ? [...members] : [];
    if (memberSortMode === "LINEAGE") {
      return sortMembersByLineage(list, family?.name);
    }
    if (memberSortMode === "ALPHABETICAL") {
      return list.sort((a, b) =>
        getMemberDisplayName(a).localeCompare(getMemberDisplayName(b), "ar")
      );
    }
    return list.sort((a, b) => {
      const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [members, memberSortMode]);

  const filteredMembers = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return sortedMembers;
    return sortedMembers.filter((m) => {
      const name = getMemberDisplayName(m).toLowerCase();
      const nick = String(m.nickname || "").toLowerCase();
      const first = String(m.firstName || "").toLowerCase();
      const last = String(m.lastName || "").toLowerCase();
      return name.includes(term) || nick.includes(term) || first.includes(term) || last.includes(term);
    });
  }, [sortedMembers, searchQuery]);

  const fullTreeRootMemberId = useMemo(() => {
    if (!Array.isArray(members) || members.length === 0) return null;
    const founder = members.find((member) => isFamilyFounder(member, family?.name));
    return (founder || members[0])?.id || null;
  }, [members, family?.name]);

  const activeTreeMemberId =
    treeViewMode === "FULL_FAMILY" ? fullTreeRootMemberId : selectedMemberId;

  useEffect(() => {
    if (startMemberId) {
      setSelectedMemberId(startMemberId);
      setTreeViewMode("PERSON_DESCENDANTS");
    }
  }, [startMemberId]);

  useEffect(() => {
    if (startMemberId) {
      return;
    }

    if (!Array.isArray(members) || members.length === 0) {
      return;
    }

    const hasPreferredMember = members.some((member) => member.id === preferredFocusMemberId);
    if (!hasPreferredMember) {
      return;
    }

    setSelectedMemberId(preferredFocusMemberId);
    setTreeViewMode("PERSON_DESCENDANTS");
  }, [members, startMemberId]);

  useEffect(() => {
    const loadFamily = async () => {
      try {
        setLoading(true);
        const familyData = await getFamily(familyId);
        setFamily(familyData);
        const membersData = await getMembers(familyId);
        const membersPayload = membersData as { members?: any[] } | any[];
        const memberArray = Array.isArray(membersPayload)
          ? membersPayload
          : membersPayload?.members || [];
        setMembers(memberArray as any[]);
      } catch (err) {
        console.error("Error loading family:", err);
        setError(err instanceof Error ? err.message : "تعذر تحميل بيانات العائلة");
      } finally {
        setLoading(false);
      }
    };
    loadFamily();
  }, [familyId, getFamily, getMembers]);

  useEffect(() => {
    const loadTree = async () => {
      if (!activeTreeMemberId) {
        setTreeData(null);
        return;
      }
      const cacheKey = [activeTreeMemberId, treeViewMode].join(":");
      const isManualRefresh = treeReloadTick !== lastHandledReloadTickRef.current;
      if (!isManualRefresh) {
        const cachedTree = treeCacheRef.current[cacheKey];
        if (cachedTree) {
          setTreeData(cachedTree);
          return;
        }
      }
      try {
        setTreeLoading(true);
        const response = await fetch(
          `/api/tree/${activeTreeMemberId}?depth=10&view=${treeViewMode === "FULL_FAMILY" ? "full" : "descendants"}`
        );
        if (!response.ok) throw new Error("تعذر تحميل بيانات شجرة العائلة");
        const result = await response.json();
        setTreeData(result.data);
        treeCacheRef.current[cacheKey] = result.data;
        if (isManualRefresh) {
          lastHandledReloadTickRef.current = treeReloadTick;
        }
      } catch (err) {
        console.error("Error loading tree:", err);
      } finally {
        setTreeLoading(false);
      }
    };
    loadTree();
  }, [activeTreeMemberId, treeViewMode, treeReloadTick]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>جاري تحميل شجرة العائلة...</p>
        </div>
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-red-900 border border-red-700 rounded-lg p-8 text-red-200 max-w-md">
          <h2 className="text-2xl font-bold mb-2">خطأ</h2>
          <p>{error || "العائلة غير موجودة"}</p>
          <Link href="/" className="inline-block mt-4 text-blue-400 hover:text-blue-300">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', minHeight: '-webkit-fill-available', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 py-4 shadow-sm dark:shadow-none" style={{ flexShrink: 0 }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{family.name}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {formatNumberAr(family.members?.length || 0)} فرد
              </p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition">
            <Home className="w-5 h-5" />
            <span className="hidden sm:inline">الرئيسية</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition"
            title={sidebarOpen ? 'إخفاء قائمة الأفراد' : 'إظهار قائمة الأفراد'}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">{sidebarOpen ? 'إخفاء الأفراد' : 'إظهار الأفراد'}</span>
            {sidebarOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
        <aside
          className="w-full h-[40dvh] lg:h-auto lg:w-72 bg-white dark:bg-slate-800 lg:border-l border-slate-200 dark:border-slate-700 overflow-y-auto"
          style={{ flexShrink: 0, maxHeight: '100%' }}
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-3">اختر فرداً</h2>
            <div className="mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم..."
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              بدون اختيار شخص: عرض الشجرة الكاملة. عند اختيار شخص: عرض نسله فقط حتى آخر الشجرة.
            </p>
            <div className="mt-3">
              <label className="block text-xs text-slate-700 dark:text-slate-300 mb-1">ترتيب الأفراد</label>
              <select
                value={memberSortMode}
                onChange={(e) => setMemberSortMode(e.target.value as MemberSortMode)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
              >
                <option value="SEQUENCE">حسب التسلسل</option>
                <option value="ALPHABETICAL">حسب الأبجدية</option>
                <option value="LINEAGE">حسب السلالة</option>
              </select>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => { setTreeViewMode("FULL_FAMILY"); setSelectedMemberId(null); }}
                className={`w-full px-3 py-2 rounded-lg border text-sm transition ${
                  treeViewMode === "FULL_FAMILY"
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-800 dark:text-emerald-100"
                    : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                عرض الشجرة الكاملة للعائلة
              </button>
            </div>
            <button
              type="button"
              onClick={() => setTreeReloadTick((prev) => prev + 1)}
              disabled={!activeTreeMemberId || treeLoading}
              className="mt-3 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-sm transition"
            >
              {treeLoading ? "جاري التحديث..." : "تحديث الشجرة"}
            </button>
          </div>

          <div className="p-2 space-y-1">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const founder = isFamilyFounder(member, family?.name);
                return (
                  <button
                    key={member.id}
                    onClick={() => { setSelectedMemberId(member.id); setTreeViewMode("PERSON_DESCENDANTS"); }}
                    className={`w-full text-left px-4 py-3 rounded transition text-sm border ${
                      treeViewMode === "PERSON_DESCENDANTS" && selectedMemberId === member.id
                        ? "bg-blue-600 text-white border-blue-500"
                        : founder
                          ? "text-amber-800 dark:text-amber-100 bg-amber-100/60 dark:bg-amber-900/25 border-amber-400 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/35"
                          : "text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <div className="font-medium">{getMemberDisplayName(member)}</div>
                    {founder && <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">مؤسس العائلة</div>}
                    {member.gender && (
                      <div className="text-xs opacity-70">
                        {genderLabelAr(member.gender)}
                        {member.dateOfDeath && " • متوفى"}
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-3 text-slate-400 text-sm text-center">
                {searchQuery.trim() ? "لا يوجد أفراد مطابقون" : "لا يوجد أفراد"}
              </p>
            )}
          </div>
        </aside>
        )}

        {/* Main - Tree */}
        <main style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          {treeLoading ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="text-slate-400 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>جاري تحميل الشجرة...</p>
              </div>
            </div>
          ) : treeData ? (
            <FamilyTreeVisualization
              treeData={treeData}
              familyName={
                treeViewMode === "PERSON_DESCENDANTS" && selectedMemberId
                  ? getMemberDisplayName(members.find(m => m.id === selectedMemberId) ?? { fullName: family?.name })
                  : family?.name
              }
              loading={false}
              focusDescendantsOnly={treeViewMode === "PERSON_DESCENDANTS"}
              onRefresh={() => setTreeReloadTick(prev => prev + 1)}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p className="text-slate-400">لا تتوفر بيانات شجرة حالياً</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}