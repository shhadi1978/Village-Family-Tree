"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, Search, UserCheck } from "lucide-react";
import { formatDateAr } from "@/lib/i18n/format";
import { getMemberDisplayName } from "@/lib/member-display";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | Date | null;
  dateOfDeath?: string | Date | null;
  photoUrl?: string | null;
  familyId: string;
  villageId: string;
}

interface MemberDetailDialogProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  familyName?: string;
}

export default function MemberDetailDialog({
  member,
  isOpen,
  onClose,
  onRefresh,
  familyName,
}: MemberDetailDialogProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [childName, setChildName] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [motherSearch, setMotherSearch] = useState("");
  const [motherCandidates, setMotherCandidates] = useState<Member[]>([]);
  const [selectedMotherId, setSelectedMotherId] = useState<string>("");
  const [currentMotherName, setCurrentMotherName] = useState<string | null>(null);
  const [hasMother, setHasMother] = useState(false);
  const [fatherTreeTarget, setFatherTreeTarget] = useState<{ familyId: string; memberId: string; name: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !member) {
      return;
    }

    const loadMotherStatus = async () => {
      try {
        const response = await fetch(`/api/relationships?memberId=${member.id}&type=PARENT`);
        if (!response.ok) {
          return;
        }

        const result = await response.json();
        const parents = result?.data?.parents || [];
        const motherRelation = parents.find(
          (rel: any) => rel?.fromMember?.gender === "FEMALE"
        );
        const fatherRelation = parents.find(
          (rel: any) => rel?.fromMember?.gender === "MALE"
        );

        if (motherRelation?.fromMember?.fullName) {
          setHasMother(true);
          setCurrentMotherName(motherRelation.fromMember.fullName);
        } else {
          setHasMother(false);
          setCurrentMotherName(null);
        }

        if (fatherRelation?.fromMember?.familyId && fatherRelation?.fromMember?.id) {
          setFatherTreeTarget({
            familyId: fatherRelation.fromMember.familyId,
            memberId: fatherRelation.fromMember.id,
            name: fatherRelation.fromMember.fullName || "والدها",
          });
        } else {
          setFatherTreeTarget(null);
        }
      } catch {
        // Keep UI usable even if relationship status fails to load.
      }
    };

    setMotherSearch("");
    setMotherCandidates([]);
    setSelectedMotherId("");
    loadMotherStatus();
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const memberGender = member.gender ? String(member.gender).toUpperCase() : "OTHER";
  const isMale = memberGender === "MALE";
  const isFemale = memberGender === "FEMALE";
  const allowedSpouseGender: "MALE" | "FEMALE" | null = isMale
    ? "FEMALE"
    : isFemale
      ? "MALE"
      : null;

  const splitName = (fullName: string, fallbackLastName?: string | null) => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      return { firstName: "", lastName: fallbackLastName || "" };
    }

    const parts = trimmed.split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || fallbackLastName || "";
    return { firstName, lastName };
  };

  const handleAddChild = async (childGender: "MALE" | "FEMALE") => {
    setLoadingAction(`add-child-${childGender}`);
    setError(null);
    setSuccessMessage(null);

    try {
      const parsed = splitName(childName, member.lastName);
      if (!parsed.firstName) {
        setError("اكتب اسم الطفل أولاً");
        setLoadingAction(null);
        return;
      }

      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          gender: childGender,
          familyId: member.familyId,
          villageId: member.villageId,
          parentId: member.id,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "فشل إضافة الطفل");
      }

      setChildName("");
      setSuccessMessage("تمت إضافة الطفل بنجاح");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAddSpouse = async (spouseGender: "MALE" | "FEMALE") => {
    setLoadingAction(`add-spouse-${spouseGender}`);
    setError(null);
    setSuccessMessage(null);

    try {
      const parsed = splitName(spouseName, member.lastName);
      if (!parsed.firstName) {
        setError("اكتب اسم الزوج/الزوجة أولاً");
        setLoadingAction(null);
        return;
      }

      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          gender: spouseGender,
          familyId: member.familyId,
          villageId: member.villageId,
          spouseId: member.id,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "فشل إضافة الزوج/الزوجة");
      }

      setSpouseName("");
      setSuccessMessage("تمت إضافة الزوج/الزوجة بنجاح");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteAllRelationships = async () => {
    if (
      !confirm(
        "هل تريد حقاً حذف جميع العلاقات (الآباء والأبناء والزوج/الزوجة) من الشجرة؟\nهذا سيزيل الفرد من الشجرة ولكن لن يحذفه من قاعدة البيانات."
      )
    ) {
      return;
    }

    setLoadingAction("delete-relationships");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/relationships/delete-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "فشل حذف العلاقات");
      }

      setSuccessMessage("تم حذف العلاقات بنجاح");
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSearchMothers = async () => {
    if (!member) return;
    const query = motherSearch.trim();
    if (!query) {
      setMotherCandidates([]);
      return;
    }

    setLoadingAction("search-mother");
    setError(null);

    try {
      const response = await fetch(
        `/api/members?villageId=${member.villageId}&search=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("تعذر البحث عن الأمهات المرشحات");
      }

      const result = await response.json();
      const members = Array.isArray(result?.data) ? result.data : [];
      const femaleCandidates = members.filter(
        (candidate: Member) =>
          candidate.id !== member.id &&
          String(candidate.gender || "").toUpperCase() === "FEMALE"
      );

      setMotherCandidates(femaleCandidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف أثناء البحث");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAssignMother = async () => {
    if (!member || !selectedMotherId) {
      setError("اختر الأم أولاً من نتائج البحث");
      return;
    }

    setLoadingAction("assign-mother");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromMemberId: selectedMotherId,
          toMemberId: member.id,
          type: "PARENT",
          villageId: member.villageId,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "تعذر ربط الأم");
      }

      const linkedMother = motherCandidates.find((candidate) => candidate.id === selectedMotherId);
      setCurrentMotherName(linkedMother?.fullName || null);
      setHasMother(true);
      setMotherCandidates([]);
      setSelectedMotherId("");
      setMotherSearch("");
      setSuccessMessage("تم ربط الأم بنجاح");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGoToFatherTree = () => {
    if (!fatherTreeTarget) {
      return;
    }

    onClose();
    router.push(`/family/${fatherTreeTarget.familyId}?member=${fatherTreeTarget.memberId}`);
  };

  const dialogContent = (
    <div className="fixed inset-0 z-50" dir="rtl">
      <button
        type="button"
        aria-label="إغلاق نافذة التفاصيل"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-slate-800 border-l border-slate-700 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur border-b border-slate-700 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white text-lg font-bold">تفاصيل الفرد</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <X size={22} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">يمكنك تعديل الشجرة من هذه اللوحة مباشرة</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
            <div className="text-center">
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={member.fullName}
                  className="w-16 h-16 rounded-full object-cover mx-auto mb-2 border-2 border-blue-500"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">👤</span>
                </div>
              )}
              <h3 className="text-white text-lg font-semibold">{getMemberDisplayName(member)}</h3>
            </div>

            {fatherTreeTarget && (
              <button
                onClick={handleGoToFatherTree}
                className="w-full mt-4 px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition"
              >
                الانتقال إلى شجرة والدها: {fatherTreeTarget.name}
              </button>
            )}

            <div className="space-y-2 text-sm text-slate-300 mt-4">
              {member.dateOfBirth && (
                <p className="flex justify-between">
                  <span>تاريخ الميلاد:</span>
                  <span className="text-white">{formatDateAr(member.dateOfBirth)}</span>
                </p>
              )}
              {member.dateOfDeath && (
                <p className="flex justify-between">
                  <span>تاريخ الوفاة:</span>
                  <span className="text-red-400">{formatDateAr(member.dateOfDeath)}</span>
                </p>
              )}
            </div>
          </div>

          {error && <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>}
          {successMessage && <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-300 text-sm">{successMessage}</div>}

          <div className="space-y-2 pt-2">
            <div className="rounded-lg border border-slate-700 p-3 space-y-2">
              <div className="flex items-center gap-2 text-slate-200 text-sm">
                <UserCheck size={16} />
                <span>تعيين أم</span>
              </div>

              {hasMother ? (
                <div className="text-xs rounded border border-emerald-700 bg-emerald-900/20 text-emerald-300 px-3 py-2">
                  الأم الحالية: {currentMotherName || "مربوطة"}
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-400">هذا الفرد لا يملك أم مرتبطة بعد.</p>
                  <div className="flex gap-2">
                    <input
                      value={motherSearch}
                      onChange={(e) => setMotherSearch(e.target.value)}
                      placeholder="ابحث باسم الأم"
                      className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleSearchMothers}
                      disabled={loadingAction === "search-mother" || !motherSearch.trim()}
                      className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-600 text-white text-sm"
                    >
                      <Search size={16} />
                    </button>
                  </div>

                  {motherCandidates.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-slate-700 rounded">
                      {motherCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => setSelectedMotherId(candidate.id)}
                          className={`w-full text-right px-3 py-2 text-sm border-b last:border-b-0 border-slate-700 transition ${
                            selectedMotherId === candidate.id
                              ? "bg-emerald-900/40 text-emerald-300"
                              : "text-slate-200 hover:bg-slate-700/70"
                          }`}
                        >
                          {candidate.fullName}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleAssignMother}
                    disabled={loadingAction === "assign-mother" || !selectedMotherId}
                    className="w-full px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-600 text-white text-sm"
                  >
                    {loadingAction === "assign-mother" ? "جاري الربط..." : "ربط الأم المختارة"}
                  </button>
                </>
              )}
            </div>

            <div className="rounded-lg border border-slate-700 p-3 space-y-2">
              <p className="text-xs text-slate-300">إضافة طفل جديد</p>
              <input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="اكتب الاسم الكامل للطفل"
                className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAddChild("MALE")}
                  disabled={loadingAction?.startsWith("add-child") || !childName.trim()}
                  className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
                >
                  <Plus size={16} />
                  <span className="text-xs">{loadingAction === "add-child-MALE" ? "جاري الإضافة..." : "+ ابن"}</span>
                </button>
                <button
                  onClick={() => handleAddChild("FEMALE")}
                  disabled={loadingAction?.startsWith("add-child") || !childName.trim()}
                  className="flex items-center justify-center gap-1 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
                >
                  <Plus size={16} />
                  <span className="text-xs">{loadingAction === "add-child-FEMALE" ? "جاري الإضافة..." : "+ ابنة"}</span>
                </button>
              </div>
            </div>

            {allowedSpouseGender ? (
              <div className="rounded-lg border border-slate-700 p-3 space-y-2">
                <p className="text-xs text-slate-300">إضافة زوج/زوجة</p>
                <input
                  value={spouseName}
                  onChange={(e) => setSpouseName(e.target.value)}
                  placeholder="اكتب الاسم الكامل للزوج/الزوجة"
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => handleAddSpouse(allowedSpouseGender)}
                  disabled={loadingAction?.startsWith("add-spouse") || !spouseName.trim()}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
                >
                  <Plus size={16} />
                  <span className="text-xs">
                    {loadingAction?.startsWith("add-spouse")
                      ? "جاري الإضافة..."
                      : allowedSpouseGender === "MALE"
                        ? "+ زوج"
                        : "+ زوجة"}
                  </span>
                </button>
              </div>
            ) : (
              <div className="p-2 rounded border border-slate-600 text-slate-300 text-xs text-center">
                لا يمكن تحديد زوج/زوجة تلقائيًا لأن نوع هذا الفرد غير محدد.
              </div>
            )}

            <button
              onClick={handleDeleteAllRelationships}
              disabled={loadingAction === "delete-relationships"}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 disabled:bg-slate-600 border border-red-700 text-red-300 hover:text-red-200 rounded text-sm font-medium transition"
            >
              <Trash2 size={16} />
              <span>حذف العلاقات من الشجرة</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end sticky bottom-0 bg-slate-800/95 backdrop-blur">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") {
    return null;
  }

  return createPortal(dialogContent, document.body);
}
