"use client";

import { useEffect, useMemo, useState } from "react";
import { useMembers } from "@/lib/hooks/use-api";
import { Upload, Save, X } from "lucide-react";
import { getMemberDisplayName, getMemberOptionLabel } from "@/lib/member-display";

interface MemberFormProps {
  familyId: string;
  villageId: string;
  memberId?: string;
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function MemberForm({
  familyId,
  villageId,
  memberId,
  initialData,
  onSuccess,
  onCancel,
}: MemberFormProps) {
  const { createMember, updateMember, getMembers } = useMembers();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [villageMembers, setVillageMembers] = useState<any[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialData?.photoUrl || null
  );

  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    nickname: initialData?.nickname || "",
    gender: initialData?.gender || "MALE",
    dateOfBirth: initialData?.dateOfBirth || "",
    dateOfDeath: initialData?.dateOfDeath || "",
    bio: initialData?.bio || "",
    photoUrl: initialData?.photoUrl || "",
    isFounder: initialData?.isFounder || false,
    fatherId: "",
    motherId: "",
  });

  useEffect(() => {
    const loadVillageMembers = async () => {
      if (memberId || !villageId) {
        return;
      }

      setParentsLoading(true);
      try {
        const result = await getMembers(undefined, villageId);
        const payload = result as { members?: any[] } | any[];
        const list = Array.isArray(payload) ? payload : payload?.members || [];
        setVillageMembers(list);
      } catch (err) {
        console.error("Error loading potential parents:", err);
      } finally {
        setParentsLoading(false);
      }
    };

    loadVillageMembers();
  }, [memberId, villageId, getMembers]);

  const fatherOptions = useMemo(() => {
    return villageMembers.filter(
      (candidate) => candidate.gender === "MALE" && candidate.familyId === familyId
    );
  }, [villageMembers, familyId]);

  const motherOptions = useMemo(() => {
    return villageMembers.filter(
      (candidate) =>
        candidate.gender === "FEMALE" && candidate.id !== formData.fatherId
    );
  }, [villageMembers, formData.fatherId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, upload to UploadThing
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setFormData((prev) => ({
          ...prev,
          photoUrl: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (memberId) {
        // Update existing member
        await updateMember(memberId, {
          ...formData,
          dateOfBirth: formData.dateOfBirth
            ? new Date(formData.dateOfBirth)
            : undefined,
          dateOfDeath: formData.dateOfDeath
            ? new Date(formData.dateOfDeath)
            : undefined,
        });
      } else {
        // Create new member
        await createMember({
          ...formData,
          familyId,
          villageId,
          fatherId: formData.fatherId,
          motherId: formData.motherId || undefined,
        });
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ بيانات الفرد");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-white mb-4">البيانات الأساسية</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              الاسم الأول *
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              placeholder="مثال: أحمد"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              اسم العائلة *
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              placeholder="مثال: المصري"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            الكنية (اختياري)
          </label>
          <input
            type="text"
            name="nickname"
            value={formData.nickname}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            placeholder="مثال: أبو محمد"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            الجنس *
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="MALE">ذكر</option>
            <option value="FEMALE">أنثى</option>
            <option value="OTHER">آخر</option>
          </select>
        </div>

        {memberId && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isFounder"
              name="isFounder"
              checked={Boolean(formData.isFounder)}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  isFounder: e.target.checked,
                }));
              }}
              className="w-4 h-4 bg-slate-700 border border-slate-600 rounded cursor-pointer"
            />
            <label htmlFor="isFounder" className="text-sm font-medium text-slate-300 cursor-pointer">
              مؤسس العائلة
            </label>
            <p className="text-xs text-slate-400 ml-auto">
              (يمكن فقط مسؤولو النظام تعديل هذا الحقل)
            </p>
          </div>
        )}

        {!memberId && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                الأب *
              </label>
              <select
                name="fatherId"
                value={formData.fatherId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">
                  {parentsLoading ? "جاري تحميل الآباء..." : "اختر الأب (من نفس العائلة)"}
                </option>
                {fatherOptions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {getMemberOptionLabel(candidate, fatherOptions)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                الانتساب دائماً للأب، لذلك يجب أن يكون الأب من نفس العائلة.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                الأم (اختياري)
              </label>
              <select
                name="motherId"
                value={formData.motherId}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">بدون تحديد</option>
                {motherOptions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {getMemberOptionLabel(candidate, motherOptions)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Photo Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h3 className="font-semibold text-white mb-4">صورة الفرد</h3>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-32 h-32 bg-slate-700 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-600">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="معاينة الصورة"
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <span className="text-slate-400">لا توجد صورة</span>
            )}
          </div>

          <div className="flex-1">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition">
                <Upload className="w-4 h-4" />
                رفع صورة
              </span>
            </label>
            <p className="text-sm text-slate-400 mt-2">
              JPG أو PNG أو GIF (الحد الأقصى 4MB)
            </p>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-white mb-4">التواريخ المهمة</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              تاريخ الميلاد
            </label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              تاريخ الوفاة
            </label>
            <input
              type="date"
              name="dateOfDeath"
              value={formData.dateOfDeath}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          نبذة تعريفية
        </label>
        <textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          rows={4}
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          placeholder="أضف نبذة أو معلومات إضافية عن هذا الفرد..."
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition font-medium"
        >
          <Save className="w-4 h-4" />
          {loading ? "جاري الحفظ..." : memberId ? "تحديث بيانات الفرد" : "إضافة فرد"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium"
          >
            <X className="w-4 h-4" />
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}
