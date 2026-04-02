"use client";

import { useState } from "react";
import { useFamilies } from "@/lib/hooks/use-api";
import { Save, X, Upload } from "lucide-react";

interface FamilyFormProps {
  villageId: string;
  familyId?: string;
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function buildSlugFromName(name: string): string {
  const latinSlug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

  return latinSlug || `family-${Date.now()}`;
}

export default function FamilyForm({
  villageId,
  familyId,
  initialData,
  onSuccess,
  onCancel,
}: FamilyFormProps) {
  const { createFamily, updateFamily } = useFamilies();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialData?.photoUrl || null
  );

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    description: initialData?.description || "",
    photoUrl: initialData?.photoUrl || "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Auto-generate slug from name
    if (name === "name") {
      const newSlug = buildSlugFromName(value);
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        slug: newSlug,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

    const normalizedSlug = buildSlugFromName(formData.slug || formData.name);

    try {
      if (familyId) {
        await updateFamily(familyId, {
          name: formData.name,
          slug: normalizedSlug,
          description: formData.description,
          photoUrl: formData.photoUrl,
        });
      } else {
        await createFamily({
          name: formData.name,
          slug: normalizedSlug,
          villageId,
          description: formData.description,
          photoUrl: formData.photoUrl,
        });
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ بيانات العائلة");
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

      {/* Photo Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h3 className="font-semibold text-white mb-4">صورة العائلة</h3>
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

      {/* Family Info */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-white mb-4">بيانات العائلة</h3>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            اسم العائلة *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            placeholder="مثال: عائلة الأحمد"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            معرف الرابط (Slug) *
          </label>
          <input
            type="text"
            name="slug"
            value={formData.slug}
            onChange={handleChange}
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            placeholder="يتم توليده تلقائياً من الاسم"
          />
          <p className="text-xs text-slate-400 mt-1">
            أحرف إنجليزية صغيرة وأرقام وشرطة فقط
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            وصف العائلة
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            placeholder="أضف معلومات عن تاريخ العائلة وأصولها وأبرز أفرادها..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition font-medium"
        >
          <Save className="w-4 h-4" />
          {loading ? "جاري الحفظ..." : familyId ? "تحديث العائلة" : "إنشاء عائلة"}
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
