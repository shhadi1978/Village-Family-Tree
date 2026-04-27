"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, Search, UserCheck, Upload, Loader2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateAr } from "@/lib/i18n/format";
import { getMemberDisplayName } from "@/lib/member-display";
import { useRouter } from "next/navigation";
import { genUploader } from "uploadthing/client";

const uploadFiles = genUploader({ url: "/api/uploadthing", package: "@uploadthing/react" });

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
  family?: {
    id: string;
    name: string;
  } | null;
  isExternal?: boolean;
  externalOriginText?: string | null;
  externalNotes?: string | null;
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
  const [spouseSearch, setSpouseSearch] = useState("");
  const [spouseCandidates, setSpouseCandidates] = useState<Member[]>([]);
  const [selectedSpouseId, setSelectedSpouseId] = useState<string>("");
  const [isExternalSpouse, setIsExternalSpouse] = useState(false);
  const [externalOriginText, setExternalOriginText] = useState("");
  const [externalNotes, setExternalNotes] = useState("");
  const [motherSearch, setMotherSearch] = useState("");
  const [motherCandidates, setMotherCandidates] = useState<Member[]>([]);
  const [selectedMotherId, setSelectedMotherId] = useState<string>("");
  const [currentMotherName, setCurrentMotherName] = useState<string | null>(null);
  const [hasMother, setHasMother] = useState(false);
  const [fatherTreeTarget, setFatherTreeTarget] = useState<{ familyId: string; memberId: string; name: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  // Inline edit state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editDateOfDeath, setEditDateOfDeath] = useState("");
  const [editBio, setEditBio] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

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
    setSpouseSearch("");
    setSpouseCandidates([]);
    setSelectedSpouseId("");
    setIsExternalSpouse(false);
    setExternalOriginText("");
    setExternalNotes("");
    setPhotoUrl(member.photoUrl || null);
    setIsEditOpen(false);
    setEditFirstName(member.firstName || "");
    setEditLastName(member.lastName || "");
    setEditNickname((member as any).nickname || "");
    setEditGender(member.gender ? String(member.gender).toUpperCase() : "MALE");
    setEditDateOfBirth(formatDateForInput((member as any).dateOfBirth));
    setEditDateOfDeath(formatDateForInput((member as any).dateOfDeath));
    setEditBio((member as any).bio || "");
    setEditError(null);
    setEditSuccess(null);
    loadMotherStatus();
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  function formatDateForInput(value?: string | Date | null): string {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  const handleSaveEdit = async () => {
    if (!editFirstName.trim()) {
      setEditError("الاسم الأول مطلوب");
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    setEditSuccess(null);
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          nickname: editNickname.trim() || null,
          gender: editGender,
          dateOfBirth: editDateOfBirth || null,
          dateOfDeath: editDateOfDeath || null,
          bio: editBio.trim() || null,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "فشل الحفظ");
      setEditSuccess("تم حفظ التعديلات بنجاح");
      onRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setIsSavingEdit(false);
    }
  };

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
          isExternal: isExternalSpouse,
          externalOriginText: isExternalSpouse ? externalOriginText : undefined,
          externalNotes: isExternalSpouse ? externalNotes : undefined,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "فشل إضافة الزوج/الزوجة");
      }

      setSpouseName("");
      setExternalOriginText("");
      setExternalNotes("");
      setIsExternalSpouse(false);
      setSuccessMessage("تمت إضافة الزوج/الزوجة بنجاح");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSearchSpouses = async () => {
    if (!member || !allowedSpouseGender) return;

    const query = spouseSearch.trim();
    if (!query) {
      setSpouseCandidates([]);
      return;
    }

    setLoadingAction("search-spouse");
    setError(null);

    try {
      const response = await fetch(
        `/api/members?villageId=${member.villageId}&search=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("تعذر البحث عن الأزواج/الزوجات");
      }

      const result = await response.json();
      const members = Array.isArray(result?.data) ? result.data : [];
      const filteredCandidates = members.filter((candidate: Member) => {
        if (candidate.id === member.id) {
          return false;
        }

        return String(candidate.gender || "").toUpperCase() === allowedSpouseGender;
      });

      setSpouseCandidates(filteredCandidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف أثناء البحث");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAssignExistingSpouse = async () => {
    if (!member || !selectedSpouseId) {
      setError("اختر الزوج/الزوجة أولاً من نتائج البحث");
      return;
    }

    setLoadingAction("assign-spouse");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromMemberId: member.id,
          toMemberId: selectedSpouseId,
          type: "SPOUSE",
          villageId: member.villageId,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "تعذر ربط الزوج/الزوجة");
      }

      setSpouseSearch("");
      setSpouseCandidates([]);
      setSelectedSpouseId("");
      setSuccessMessage("تم ربط الزوج/الزوجة بنجاح");
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

  const handleChoosePhoto = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file || !member) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    if (!file.type.startsWith("image/")) {
      setError("اختر ملف صورة صالحًا فقط");
      input.value = "";
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("حجم الصورة يجب أن يكون أقل من 4 ميغابايت");
      input.value = "";
      return;
    }

    setLoadingAction("upload-photo");

    try {
      const uploadedFiles = await uploadFiles("memberProfile", {
        files: [file],
      });

      const uploadedFile = uploadedFiles?.[0];
      const nextPhotoUrl = uploadedFile?.url || (uploadedFile?.serverData as any)?.fileUrl;

      if (!nextPhotoUrl) {
        throw new Error("تعذر الحصول على رابط الصورة بعد الرفع");
      }

      const response = await fetch(`/api/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: nextPhotoUrl }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "فشل حفظ صورة الفرد");
      }

      setPhotoUrl(nextPhotoUrl);
      setSuccessMessage("تم تحديث صورة الفرد بنجاح");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر رفع الصورة");
    } finally {
      setLoadingAction(null);
      input.value = "";
    }
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
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={member.fullName}
                  className="w-20 h-20 rounded-full object-cover mx-auto mb-2 border-2 border-blue-500"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">👤</span>
                </div>
              )}
              <h3 className="text-white text-lg font-semibold">{getMemberDisplayName(member)}</h3>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelected}
              />
              <button
                type="button"
                onClick={handleChoosePhoto}
                disabled={loadingAction === "upload-photo"}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded bg-sky-700 hover:bg-sky-600 disabled:bg-slate-600 text-white text-sm transition"
              >
                {loadingAction === "upload-photo" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span>{loadingAction === "upload-photo" ? "جاري رفع الصورة..." : photoUrl ? "تغيير الصورة" : "إضافة صورة"}</span>
              </button>
              <p className="text-xs text-slate-400 mt-2">الصيغ المدعومة: JPG, PNG, GIF, WebP حتى 4MB</p>
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
              {(Boolean((member as any).isExternal) || Boolean((member as any).externalOriginText) || Boolean((member as any).externalNotes)) && (
                <div className="p-2 rounded bg-amber-900/40 border border-amber-700">
                  <p className="text-amber-200 font-medium mb-1">من خارج القرية</p>
                  {(member as any).externalOriginText && (
                    <p className="text-amber-100/90 text-xs">
                      <span className="text-amber-300 font-medium">المنشأ:</span> {(member as any).externalOriginText}
                    </p>
                  )}
                  {(member as any).externalNotes && (
                    <p className="text-amber-100/90 text-xs mt-1">
                      <span className="text-amber-300 font-medium">ملاحظات:</span> {(member as any).externalNotes}
                    </p>
                  )}
                </div>
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
          </div>

          {error && <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>}
          {successMessage && <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-300 text-sm">{successMessage}</div>}

          {/* ── Inline edit section ── */}
          <div className="rounded-lg border border-slate-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsEditOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/60 hover:bg-slate-700 transition text-sm font-medium text-white"
            >
              <span className="flex items-center gap-2"><Pencil size={14} /> تعديل البيانات الأساسية</span>
              {isEditOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {isEditOpen && (
              <div className="p-4 space-y-3 bg-slate-800/60">
                {editError && <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">{editError}</div>}
                {editSuccess && <div className="p-2 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-300 text-xs">{editSuccess}</div>}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">الاسم الأول *</label>
                    <input
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">اسم العائلة</label>
                    <input
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">الكنية / اللقب</label>
                  <input
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="اختياري"
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">الجنس</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MALE">ذكر</option>
                    <option value="FEMALE">أنثى</option>
                    <option value="OTHER">غير محدد</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">تاريخ الميلاد</label>
                    <input
                      type="date"
                      value={editDateOfBirth}
                      onChange={(e) => setEditDateOfBirth(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">تاريخ الوفاة</label>
                    <input
                      type="date"
                      value={editDateOfDeath}
                      onChange={(e) => setEditDateOfDeath(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">نبذة / ملاحظات</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    placeholder="اختياري"
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded text-sm font-medium transition"
                >
                  {isSavingEdit ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
                  {isSavingEdit ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            )}
          </div>

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
                <p className="text-xs text-slate-400">
                  يمكنك اختيار {allowedSpouseGender === "MALE" ? "زوج" : "زوجة"} من نفس العائلة أو من عائلات أخرى داخل نفس القرية.
                </p>
                <div className="flex gap-2">
                  <input
                    value={spouseSearch}
                    onChange={(e) => setSpouseSearch(e.target.value)}
                    placeholder="ابحث باسم الزوج/الزوجة الموجودة"
                    className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleSearchSpouses}
                    disabled={loadingAction === "search-spouse" || !spouseSearch.trim()}
                    className="px-3 py-2 rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-600 text-white text-sm"
                  >
                    <Search size={16} />
                  </button>
                </div>

                {spouseCandidates.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border border-slate-700 rounded">
                    {spouseCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedSpouseId(candidate.id)}
                        className={`w-full text-right px-3 py-2 text-sm border-b last:border-b-0 border-slate-700 transition ${
                          selectedSpouseId === candidate.id
                            ? "bg-indigo-900/40 text-indigo-300"
                            : "text-slate-200 hover:bg-slate-700/70"
                        }`}
                      >
                        <div className="font-medium">{candidate.fullName}</div>
                        <div className="text-[11px] text-slate-400">
                          {candidate.family?.name || "عائلة غير معروفة"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleAssignExistingSpouse}
                  disabled={loadingAction === "assign-spouse" || !selectedSpouseId}
                  className="w-full px-3 py-2 rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-600 text-white text-sm"
                >
                  {loadingAction === "assign-spouse" ? "جاري الربط..." : "ربط الزوج/الزوجة المختارة"}
                </button>

                <div className="border-t border-slate-700 pt-2 mt-1">
                  <p className="text-xs text-slate-400 mb-2">أو أنشئ زوج/زوجة جديدة:</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={isExternalSpouse}
                    onChange={(e) => setIsExternalSpouse(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span>من خارج القرية (لا تتبع عائلة داخل القرية)</span>
                </label>
                <input
                  value={spouseName}
                  onChange={(e) => setSpouseName(e.target.value)}
                  placeholder="اكتب الاسم الكامل للزوج/الزوجة"
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {isExternalSpouse && (
                  <>
                    <input
                      value={externalOriginText}
                      onChange={(e) => setExternalOriginText(e.target.value)}
                      placeholder="المنشأ (مثال: من قرية كذا / مدينة كذا)"
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <textarea
                      value={externalNotes}
                      onChange={(e) => setExternalNotes(e.target.value)}
                      placeholder="ملاحظات إضافية (اختياري)"
                      rows={2}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </>
                )}
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
