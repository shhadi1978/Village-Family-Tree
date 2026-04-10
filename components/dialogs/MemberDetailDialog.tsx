"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { genderLabelAr, formatDateAr } from "@/lib/i18n/format";
import { getMemberDisplayName } from "@/lib/member-display";

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-md w-full border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-white text-xl font-bold">تفاصيل الفرد</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Member Info */}
        <div className="p-6 space-y-4">
          {/* Avatar & Name */}
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
            <h3 className="text-white text-lg font-semibold">
              {getMemberDisplayName(member)}
            </h3>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm text-slate-300">
            {member.gender && (
              <p className="flex justify-between">
                <span>النوع:</span>
                <span className="text-white">{genderLabelAr(member.gender)}</span>
              </p>
            )}
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

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-300 text-sm">
              {successMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
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
                <span className="text-xs">
                  {loadingAction === "add-child-MALE" ? "جاري الإضافة..." : "+ ابن"}
                </span>
              </button>
              <button
                onClick={() => handleAddChild("FEMALE")}
                disabled={loadingAction?.startsWith("add-child") || !childName.trim()}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
              >
                <Plus size={16} />
                <span className="text-xs">
                  {loadingAction === "add-child-FEMALE" ? "جاري الإضافة..." : "+ ابنة"}
                </span>
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

                <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handleAddSpouse(allowedSpouseGender)}
                  disabled={loadingAction?.startsWith("add-spouse") || !spouseName.trim()}
                  className="flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-end">
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
}
