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

  if (!isOpen || !member) return null;

  const memberGender = member.gender ? String(member.gender).toUpperCase() : "OTHER";
  const isMale = memberGender === "MALE";
  const isFemale = memberGender === "FEMALE";

  const handleAddChild = async (childGender: "MALE" | "FEMALE") => {
    setLoadingAction(`add-child-${childGender}`);
    setError(null);

    try {
      const childLabel = childGender === "MALE" ? "ابن" : "ابنة";
      const childName = prompt(`أدخل اسم ${childLabel}:`);

      if (!childName) {
        setLoadingAction(null);
        return;
      }

      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: childName.split(" ")[0],
          lastName: childName.split(" ").slice(1).join(" ") || member.lastName,
          gender: childGender,
          familyId: member.familyId,
          villageId: member.villageId,
          parentId: member.id,
        }),
      });

      if (!response.ok) {
        throw new Error("فشل إضافة الطفل");
      }

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

    try {
      const spouseLabel = spouseGender === "MALE" ? "زوج" : "زوجة";
      const spouseName = prompt(`أدخل اسم ${spouseLabel}:`);

      if (!spouseName) {
        setLoadingAction(null);
        return;
      }

      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: spouseName.split(" ")[0],
          lastName: spouseName.split(" ").slice(1).join(" "),
          gender: spouseGender,
          familyId: member.familyId,
          villageId: member.villageId,
          spouseId: member.id,
        }),
      });

      if (!response.ok) {
        throw new Error("فشل إضافة الزوج/الزوجة");
      }

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

    try {
      const response = await fetch(`/api/relationships/delete-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });

      if (!response.ok) {
        throw new Error("فشل حذف العلاقات");
      }

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

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAddChild("MALE")}
                disabled={loadingAction?.startsWith("add-child")}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
              >
                <Plus size={16} />
                <span className="text-xs">+ ابن</span>
              </button>
              <button
                onClick={() => handleAddChild("FEMALE")}
                disabled={loadingAction?.startsWith("add-child")}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
              >
                <Plus size={16} />
                <span className="text-xs">+ ابنة</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAddSpouse("MALE")}
                disabled={loadingAction?.startsWith("add-spouse")}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
              >
                <Plus size={16} />
                <span className="text-xs">+ زوج</span>
              </button>
              <button
                onClick={() => handleAddSpouse("FEMALE")}
                disabled={loadingAction?.startsWith("add-spouse")}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
              >
                <Plus size={16} />
                <span className="text-xs">+ زوجة</span>
              </button>
            </div>

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
