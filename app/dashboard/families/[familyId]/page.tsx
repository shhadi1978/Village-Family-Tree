"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFamilies, useMembers, useRelationships } from "@/lib/hooks/use-api";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatDateAr, formatNumberAr, genderLabelAr } from "@/lib/i18n/format";
import { getMemberDisplayName, getMemberOptionLabel } from "@/lib/member-display";
import { isFamilyFounder } from "@/lib/member-founder";
import { sortMembersByLineage } from "@/lib/member-lineage-sort";
import { buildLineageStatsByMember } from "@/lib/member-lineage-stats";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Edit,
  ArrowLeft,
  User,
  Calendar,
} from "lucide-react";

type RelatedMember = {
  id: string;
  fullName?: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  familyId?: string;
};

type RelationshipIntent = "FATHER" | "MOTHER" | "CHILD" | "SPOUSE";
type MemberSortMode = "SEQUENCE" | "ALPHABETICAL" | "LINEAGE";

type RelationshipRecord = {
  id: string;
  type: "PARENT" | "SPOUSE";
  fromMemberId: string;
  toMemberId: string;
  fromMember?: RelatedMember;
  toMember?: RelatedMember;
};

type SearchableUser = {
  clerkId: string;
  fullName: string;
  email: string;
  imageUrl?: string;
};

function getAdminRoleLabel(role: string): string {
  if (role === "admin") return "مدير";
  if (role === "editor") return "محرر";
  if (role === "viewer") return "مشاهد";
  if (role === "all_families_admin") return "مدير كل العائلات في القرية";
  return role;
}

type MemberRelationshipsResponse = {
  from?: RelationshipRecord[];
  to?: RelationshipRecord[];
};

function relationshipLabel(
  relationship: RelationshipRecord,
  currentMemberId: string
): string {
  if (relationship.type === "SPOUSE") {
    return "زوج/زوجة";
  }

  return relationship.toMemberId === currentMemberId
    ? "والد/والدة"
    : "ابن/ابنة";
}

export default function FamilyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const familyId = params.familyId as string;
  const {
    canManageFamily,
    canEditFamily,
    canCreateMember,
    canEditMember,
    canDeleteMember,
    canDeleteFamily,
    canCreateRelationship,
    canDeleteRelationship,
    isSuperAdmin,
  } = usePermissions();

  const { getFamily, deleteFamily } = useFamilies();
  const {
    members,
    loading: membersLoading,
    getMembers,
    deleteMember,
  } = useMembers();
  const { getRelationships, createRelationship, deleteRelationship } =
    useRelationships();

  const [family, setFamily] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [membersLoadError, setMembersLoadError] = useState<string | null>(null);
  const [memberSortMode, setMemberSortMode] = useState<MemberSortMode>("SEQUENCE");
  const [familyAdmins, setFamilyAdmins] = useState<
    Array<{ id: string; clerkId: string; role: string }>
  >([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<SearchableUser[]>([]);
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false);
  const [selectedAdminUser, setSelectedAdminUser] = useState<SearchableUser | null>(null);
  const [newAdminRole, setNewAdminRole] = useState("admin");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedRelatedMemberId, setSelectedRelatedMemberId] = useState("");
  const [relationshipIntent, setRelationshipIntent] =
    useState<RelationshipIntent>("FATHER");
  const [memberRelationships, setMemberRelationships] = useState<RelationshipRecord[]>(
    []
  );
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [isSavingRelation, setIsSavingRelation] = useState(false);
  const [isDeletingRelation, setIsDeletingRelation] = useState(false);
  const [relationError, setRelationError] = useState<string | null>(null);
  const [relationshipFilter, setRelationshipFilter] = useState<
    "ALL" | "PARENTS" | "CHILDREN" | "SPOUSES"
  >("ALL");
  const canManage = canManageFamily(familyId);
  const canEditCurrentFamily = canEditFamily(familyId);
  const canCreateCurrentMember = canCreateMember(familyId);
  const canEditCurrentMember = canEditMember(familyId);
  const canDeleteCurrentMember = canDeleteMember(familyId);
  const canCreateCurrentRelationship = canCreateRelationship(familyId);
  const canDeleteCurrentRelationship = canDeleteRelationship(familyId);

  const sortMembers = (list: any[]): any[] => {
    const cloned = [...list];

    if (memberSortMode === "LINEAGE") {
      return sortMembersByLineage(cloned, family?.name);
    }

    if (memberSortMode === "ALPHABETICAL") {
      return cloned.sort((a, b) => {
        const nameA = getMemberDisplayName(a);
        const nameB = getMemberDisplayName(b);
        return nameA.localeCompare(nameB, "ar");
      });
    }

    return cloned.sort((a, b) => {
      const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  };

  const refreshMembers = async () => {
    try {
      setMembersLoadError(null);
      await getMembers(familyId);
    } catch (err) {
      setMembersLoadError(
        err instanceof Error ? err.message : "تعذر تحميل الأفراد"
      );
      throw err;
    }
  };

  const filteredMembers = useMemo(() => {
    if (!Array.isArray(members)) {
      return [];
    }

    const term = memberSearchTerm.trim().toLowerCase();
    if (!term) {
      return sortMembers(members as any[]);
    }

    return sortMembers((members as any[]).filter((member: any) => {
      const fullName = String(member.fullName || "").toLowerCase();
      const nickname = String(member.nickname || "").toLowerCase();
      return fullName.includes(term) || nickname.includes(term);
    }));
  }, [members, memberSearchTerm, memberSortMode]);

  const lineageStatsByMember = useMemo(() => {
    const sourceMembers = Array.isArray(members) ? (members as any[]) : [];
    return buildLineageStatsByMember(sourceMembers);
  }, [members]);

  const filteredMemberRelationships = useMemo(() => {
    if (!selectedMemberId) {
      return memberRelationships;
    }

    if (relationshipFilter === "ALL") {
      return memberRelationships;
    }

    return memberRelationships.filter((relationship) => {
      if (relationshipFilter === "SPOUSES") {
        return relationship.type === "SPOUSE";
      }

      if (relationship.type !== "PARENT") {
        return false;
      }

      const isParentOfSelected = relationship.toMemberId === selectedMemberId;
      const isChildOfSelected = relationship.fromMemberId === selectedMemberId;

      if (relationshipFilter === "PARENTS") {
        return isParentOfSelected;
      }

      if (relationshipFilter === "CHILDREN") {
        return isChildOfSelected;
      }

      return true;
    });
  }, [memberRelationships, relationshipFilter, selectedMemberId]);

  const availableAdminSearchResults = useMemo(() => {
    if (!Array.isArray(userSearchResults) || userSearchResults.length === 0) {
      return [] as SearchableUser[];
    }

    const existingAdminIds = new Set(
      familyAdmins.map((admin) => String(admin.clerkId || "").trim())
    );

    return userSearchResults.filter(
      (user) => !existingAdminIds.has(String(user.clerkId || "").trim())
    );
  }, [familyAdmins, userSearchResults]);

  const relationshipCounts = useMemo(() => {
    if (!selectedMemberId) {
      return {
        all: memberRelationships.length,
        parents: 0,
        children: 0,
        spouses: 0,
      };
    }

    let parents = 0;
    let children = 0;
    let spouses = 0;

    for (const relationship of memberRelationships) {
      if (relationship.type === "SPOUSE") {
        spouses += 1;
        continue;
      }

      if (relationship.type === "PARENT") {
        if (relationship.toMemberId === selectedMemberId) {
          parents += 1;
        } else if (relationship.fromMemberId === selectedMemberId) {
          children += 1;
        }
      }
    }

    return {
      all: memberRelationships.length,
      parents,
      children,
      spouses,
    };
  }, [memberRelationships, selectedMemberId]);

  const selectedMember = useMemo(() => {
    if (!Array.isArray(members)) {
      return null;
    }

    return members.find((candidate: any) => candidate.id === selectedMemberId) || null;
  }, [members, selectedMemberId]);

  const availableRelatedMembers = useMemo(() => {
    if (!Array.isArray(members) || !selectedMember) {
      return [];
    }

    const filtered = members.filter((candidate: any) => {
      if (candidate.id === selectedMemberId) {
        return false;
      }

      if (relationshipIntent === "FATHER") {
        return candidate.gender === "MALE" && candidate.familyId === selectedMember.familyId;
      }

      if (relationshipIntent === "MOTHER") {
        return candidate.gender === "FEMALE";
      }

      if (relationshipIntent === "CHILD") {
        if (selectedMember.gender === "MALE") {
          return candidate.familyId === selectedMember.familyId;
        }
        return true;
      }

      return true;
    });
    return sortMembers(filtered as any[]);
  }, [members, selectedMember, selectedMemberId, relationshipIntent, memberSortMode]);

  const relationshipPreviewText = useMemo(() => {
    if (!selectedMemberId || !selectedMember) {
      return "اختر الفرد الأساسي أولاً.";
    }

    if (!selectedRelatedMemberId) {
      return "اختر الشخص المرتبط لإظهار صيغة العلاقة.";
    }

    const related = availableRelatedMembers.find(
      (candidate: any) => candidate.id === selectedRelatedMemberId
    );
    const relatedName = getMemberDisplayName(related);
    const baseName = getMemberDisplayName(selectedMember);

    if (relationshipIntent === "FATHER") {
      return `${relatedName} هو الأب لـ ${baseName}.`;
    }

    if (relationshipIntent === "MOTHER") {
      return `${relatedName} هي الأم لـ ${baseName}.`;
    }

    if (relationshipIntent === "CHILD") {
      return `${relatedName} هو ابن/ابنة لـ ${baseName}.`;
    }

    return `${relatedName} هو زوج/زوجة لـ ${baseName}.`;
  }, [selectedMemberId, selectedMember, selectedRelatedMemberId, availableRelatedMembers, relationshipIntent]);

  useEffect(() => {
    const loadFamily = async () => {
      try {
        const data = await getFamily(familyId);
        setFamily(data);
        await refreshMembers();
      } catch (err) {
        console.error("Error loading family:", err);
        setError(
          err instanceof Error ? err.message : "تعذر تحميل بيانات العائلة"
        );
      } finally {
        setLoading(false);
      }
    };

    loadFamily();
  }, [familyId, getFamily, getMembers]);

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm("هل تريد حذف هذا الفرد؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteMember(memberId);
      // Refresh members
      await refreshMembers();
    } catch (err) {
      console.error("Error deleting member:", err);
      alert("تعذر حذف الفرد");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadFamilyAdmins = async () => {
    if (!isSuperAdmin) {
      return;
    }

    setAdminsLoading(true);
    setAdminMessage(null);
    try {
      const response = await fetch(`/api/families/${familyId}/admins`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "تعذر تحميل صلاحيات العائلة");
      }

      const admins = Array.isArray(payload?.data) ? payload.data : [];
      setFamilyAdmins(admins);
    } catch (err) {
      setAdminMessage(
        err instanceof Error ? err.message : "تعذر تحميل صلاحيات العائلة"
      );
    } finally {
      setAdminsLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && familyId) {
      loadFamilyAdmins();
    }
  }, [isSuperAdmin, familyId]);

  const handleAddFamilyAdmin = async () => {
    const clerkId = selectedAdminUser?.clerkId?.trim() || "";
    if (!clerkId) {
      setAdminMessage("اختر مستخدمًا من القائمة أولاً");
      return;
    }

    const alreadyAdmin = familyAdmins.some((admin) => admin.clerkId === clerkId);
    if (alreadyAdmin) {
      setAdminMessage("هذا المستخدم لديه صلاحية على هذه العائلة بالفعل");
      return;
    }

    setAdminActionLoading(true);
    setAdminMessage(null);
    try {
      const response = await fetch(`/api/families/${familyId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId, role: newAdminRole || "admin" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "تعذر إضافة الصلاحية");
      }

      setSelectedAdminUser(null);
      setAdminUserSearch("");
      setUserSearchResults([]);
      setNewAdminRole("admin");
      setAdminMessage("تمت إضافة الصلاحية بنجاح");
      await loadFamilyAdmins();
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "تعذر إضافة الصلاحية");
    } finally {
      setAdminActionLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin || !familyId) {
      return;
    }

    if (selectedAdminUser) {
      return;
    }

    const query = adminUserSearch.trim();
    if (!query) {
      setUserSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsUserSearchLoading(true);
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}&limit=8`
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "تعذر البحث عن المستخدمين");
        }

        const results = Array.isArray(payload?.data)
          ? (payload.data as SearchableUser[])
          : [];

        setUserSearchResults(results);
      } catch (err) {
        setUserSearchResults([]);
        setAdminMessage(
          err instanceof Error ? err.message : "تعذر البحث عن المستخدمين"
        );
      } finally {
        setIsUserSearchLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [adminUserSearch, familyId, isSuperAdmin, selectedAdminUser]);

  const handleRemoveFamilyAdmin = async (clerkId: string) => {
    if (!confirm("هل تريد إزالة صلاحية هذا المستخدم من العائلة؟")) {
      return;
    }

    setAdminActionLoading(true);
    setAdminMessage(null);
    try {
      const response = await fetch(`/api/families/${familyId}/admins`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "تعذر إزالة الصلاحية");
      }

      setAdminMessage("تمت إزالة الصلاحية بنجاح");
      await loadFamilyAdmins();
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "تعذر إزالة الصلاحية");
    } finally {
      setAdminActionLoading(false);
    }
  };

  useEffect(() => {
    const memberList = Array.isArray(members) ? (members as any[]) : [];
    if (memberList.length > 0 && !selectedMemberId) {
      setSelectedMemberId(memberList[0].id);
    }
  }, [members, selectedMemberId]);

  useEffect(() => {
    const loadSelectedMemberRelationships = async () => {
      if (!canManage || !selectedMemberId) {
        setMemberRelationships([]);
        return;
      }

      setRelationsLoading(true);
      setRelationError(null);

      try {
        const payload = (await getRelationships(
          selectedMemberId
        )) as MemberRelationshipsResponse;

        const from = Array.isArray(payload?.from) ? payload.from : [];
        const to = Array.isArray(payload?.to) ? payload.to : [];
        setMemberRelationships([...from, ...to]);
      } catch (err) {
        console.error("Error loading member relationships:", err);
        setRelationError(
          err instanceof Error ? err.message : "تعذر تحميل العلاقات"
        );
      } finally {
        setRelationsLoading(false);
      }
    };

    loadSelectedMemberRelationships();
  }, [canManage, selectedMemberId, getRelationships]);

  const handleCreateRelationship = async () => {
    if (!family || !selectedMemberId || !selectedRelatedMemberId) {
      setRelationError("اختر الفردين لإضافة العلاقة");
      return;
    }

    if (selectedMemberId === selectedRelatedMemberId) {
      setRelationError("لا يمكن ربط الفرد بنفسه");
      return;
    }

    setIsSavingRelation(true);
    setRelationError(null);

    try {
      const selected = availableRelatedMembers.find(
        (candidate: any) => candidate.id === selectedRelatedMemberId
      );

      if (!selected) {
        throw new Error("الشخص المختار غير صالح لهذه العلاقة");
      }

      let fromMemberId = selectedMemberId;
      let toMemberId = selectedRelatedMemberId;
      let type: "PARENT" | "SPOUSE" = "PARENT";

      if (relationshipIntent === "FATHER") {
        if (selected.gender !== "MALE") {
          throw new Error("يجب اختيار ذكر كرابط أب");
        }
        fromMemberId = selectedRelatedMemberId;
        toMemberId = selectedMemberId;
        type = "PARENT";
      } else if (relationshipIntent === "MOTHER") {
        if (selected.gender !== "FEMALE") {
          throw new Error("يجب اختيار أنثى كرابط أم");
        }
        fromMemberId = selectedRelatedMemberId;
        toMemberId = selectedMemberId;
        type = "PARENT";
      } else if (relationshipIntent === "CHILD") {
        if (selectedMember?.gender === "OTHER") {
          throw new Error("لا يمكن إنشاء علاقة أبوة/أمومة لفرد بجنس غير محدد");
        }
        fromMemberId = selectedMemberId;
        toMemberId = selectedRelatedMemberId;
        type = "PARENT";
      } else {
        fromMemberId = selectedMemberId;
        toMemberId = selectedRelatedMemberId;
        type = "SPOUSE";
      }

      await createRelationship({
        fromMemberId,
        toMemberId,
        type,
        villageId: family.villageId,
      });

      const payload = (await getRelationships(
        selectedMemberId
      )) as MemberRelationshipsResponse;
      const from = Array.isArray(payload?.from) ? payload.from : [];
      const to = Array.isArray(payload?.to) ? payload.to : [];
      setMemberRelationships([...from, ...to]);
      setSelectedRelatedMemberId("");
    } catch (err) {
      console.error("Error creating relationship:", err);
      setRelationError(
        err instanceof Error ? err.message : "تعذر إضافة العلاقة"
      );
    } finally {
      setIsSavingRelation(false);
    }
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!confirm("هل تريد حذف هذه العلاقة؟")) {
      return;
    }

    setIsDeletingRelation(true);
    setRelationError(null);

    try {
      await deleteRelationship(relationshipId);
      setMemberRelationships((prev) =>
        prev.filter((relationship) => relationship.id !== relationshipId)
      );
    } catch (err) {
      console.error("Error deleting relationship:", err);
      setRelationError(
        err instanceof Error ? err.message : "تعذر حذف العلاقة"
      );
    } finally {
      setIsDeletingRelation(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (!family) return;
    if (!confirm(`هل أنت متأكد من حذف عائلة "${family.name}"؟\n\nسيتم حذف جميع الأفراد والعلاقات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteFamily(familyId);
      router.push("/dashboard/families");
    } catch (err) {
      console.error("Error deleting family:", err);
      alert(err instanceof Error ? err.message : "تعذر حذف العائلة");
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/families" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Link>
        <div className="text-slate-400 text-center py-12">
          جاري تحميل بيانات العائلة...
        </div>
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/families" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Link>
        <div className="bg-red-900 border border-red-700 rounded-lg p-6 text-red-200">
          {error || "العائلة غير موجودة"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/families" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" />
        العودة إلى العائلات
      </Link>

      {/* Family Header */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {family.name}
            </h1>
            {family.description && (
              <p className="text-slate-400 mb-4">{family.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{formatNumberAr(family.members?.length || 0)} فرد</span>
              </div>
              {family.stats && (
                <>
                  <div>{formatNumberAr(family.stats.livingMembers)} على قيد الحياة</div>
                  <div>{formatNumberAr(family.stats.deceasedMembers)} متوفى</div>
                </>
              )}
            </div>
          </div>
          {canEditCurrentFamily && (
            <Link
              href={`/dashboard/families/${familyId}/edit`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              تعديل العائلة
            </Link>
          )}
          {canDeleteFamily(familyId) && (
            <button
              onClick={handleDeleteFamily}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? "جاري الحذف..." : "حذف العائلة"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-800 to-purple-900 rounded-lg border border-purple-700 p-6">
        <h3 className="text-xl font-bold text-white mb-2">عرض شجرة العائلة</h3>
        <p className="text-purple-200 mb-4">
          استعرض العلاقات والأنساب الخاصة بهذه العائلة بشكل تفاعلي
        </p>
        <Link
          href={`/family/${familyId}`}
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
        >
          استكشاف الشجرة ←
        </Link>
      </div>

      {/* Members Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-white">أفراد العائلة</h2>
          {canCreateCurrentMember && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                href={`/dashboard/members/new?familyId=${familyId}`}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                إضافة فرد
              </Link>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm text-slate-300 mb-2">البحث عن فرد بالاسم الكامل</label>
          <input
            type="text"
            value={memberSearchTerm}
            onChange={(e) => setMemberSearchTerm(e.target.value)}
            placeholder="اكتب الاسم الكامل أو جزءاً منه..."
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-slate-300 mb-2">ترتيب الأفراد</label>
          <select
            value={memberSortMode}
            onChange={(e) => setMemberSortMode(e.target.value as MemberSortMode)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="SEQUENCE">حسب التسلسل</option>
            <option value="ALPHABETICAL">حسب الأبجدية</option>
            <option value="LINEAGE">حسب السلالة</option>
          </select>
        </div>

        {membersLoading ? (
          <div className="text-slate-400 text-center py-8">
            جاري تحميل الأفراد...
          </div>
        ) : membersLoadError ? (
          <div className="text-red-400">
            حدث خطأ أثناء تحميل الأفراد: {membersLoadError}
          </div>
        ) : filteredMembers.length > 0 ? (
          <div className="space-y-3">
            {filteredMembers.map((member: any) => {
              const founder = isFamilyFounder(member, family?.name);
              const lineageStats = lineageStatsByMember.get(member.id) || {
                total: 0,
                male: 0,
                female: 0,
                other: 0,
              };
              return (
              <div
                key={member.id}
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg transition border ${
                  founder
                    ? "bg-amber-900/20 border-amber-500 hover:bg-amber-900/30"
                    : "bg-slate-700 border-slate-600 hover:bg-slate-600"
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  {member.photoUrl && (
                    <img
                      src={member.photoUrl}
                      alt={member.fullName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-white">
                      {getMemberDisplayName(member)}
                    </h3>
                    {founder && (
                      <p className="text-xs text-amber-300 mt-0.5">مؤسس العائلة</p>
                    )}
                    <p className="text-xs text-slate-300 mt-1">
                      {formatNumberAr(lineageStats.total)} أفراد من سلالته • {formatNumberAr(lineageStats.male)} ذكور • {formatNumberAr(lineageStats.female)} إناث
                      {lineageStats.other > 0
                        ? ` • ${formatNumberAr(lineageStats.other)} غير محدد`
                        : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      {member.gender && (
                        <span>{genderLabelAr(member.gender)}</span>
                      )}
                      {member.dateOfBirth && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {formatDateAr(member.dateOfBirth)}
                          </span>
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/family/${familyId}?member=${member.id}`}
                      className="mt-2 inline-flex items-center text-xs text-blue-300 hover:text-blue-200"
                    >
                      عرض نسل هذا الشخص في الشجرة ←
                    </Link>
                  </div>
                </div>

                {(canEditCurrentMember || canDeleteCurrentMember) && (
                  <div className="flex items-center gap-2">
                    {canEditCurrentMember && (
                      <Link
                        href={`/dashboard/members/${member.id}/edit`}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition"
                        title="تعديل"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                    )}
                    {canDeleteCurrentMember && (
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        disabled={isDeleting}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );})}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <p className="mb-4">
              {memberSearchTerm.trim().length > 0
                ? "لا يوجد أفراد مطابقون لنتيجة البحث"
                : "لم تتم إضافة أفراد بعد"}
            </p>
            {canCreateCurrentMember && (
              <Link
                href={`/dashboard/members/new?familyId=${familyId}`}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                إضافة أول فرد
              </Link>
            )}
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">إدارة صلاحيات العائلة</h2>
            <p className="text-slate-400 text-sm mt-1">
              يحق للمستخدم Super Admin فقط منح أو سحب صلاحية إدارة هذه العائلة.
            </p>
          </div>

          {adminMessage && (
            <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 text-sm text-slate-200">
              {adminMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm text-slate-300 mb-1">المستخدم</label>
              <input
                type="text"
                value={selectedAdminUser ? `${selectedAdminUser.fullName} (${selectedAdminUser.email || selectedAdminUser.clerkId})` : adminUserSearch}
                onChange={(e) => {
                  setSelectedAdminUser(null);
                  setAdminUserSearch(e.target.value);
                }}
                placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />

              {!selectedAdminUser && adminUserSearch.trim().length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-600 bg-slate-700">
                  {isUserSearchLoading ? (
                    <p className="px-3 py-2 text-sm text-slate-300">جاري البحث...</p>
                  ) : availableAdminSearchResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400">لا يوجد مستخدمون متاحون للإضافة (إما لا توجد نتائج أو جميع النتائج لديها صلاحية بالفعل).</p>
                  ) : (
                    <div className="divide-y divide-slate-600">
                      {availableAdminSearchResults.map((user) => (
                        <button
                          key={user.clerkId}
                          type="button"
                          onClick={() => {
                            setSelectedAdminUser(user);
                            setAdminUserSearch("");
                            setUserSearchResults([]);
                          }}
                          className="w-full text-right px-3 py-2 hover:bg-slate-600 transition"
                        >
                          <div className="flex items-center gap-3">
                            {user.imageUrl ? (
                              <img
                                src={user.imageUrl}
                                alt={user.fullName}
                                className="w-8 h-8 rounded-full object-cover border border-slate-500"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-600 border border-slate-500 flex items-center justify-center text-xs text-slate-200">
                                {(user.fullName || "?").trim().charAt(0) || "?"}
                              </div>
                            )}
                            <div className="text-right">
                              <p className="text-sm text-white font-medium">{user.fullName}</p>
                              <p className="text-xs text-slate-300">{user.email || user.clerkId}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedAdminUser && (
                <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    {selectedAdminUser.imageUrl ? (
                      <img
                        src={selectedAdminUser.imageUrl}
                        alt={selectedAdminUser.fullName}
                        className="w-9 h-9 rounded-full object-cover border border-emerald-500/40"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-700/30 border border-emerald-500/40 flex items-center justify-center text-xs text-emerald-100">
                        {(selectedAdminUser.fullName || "?").trim().charAt(0) || "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-emerald-200 font-medium">تم اختيار: {selectedAdminUser.fullName}</p>
                      <p className="text-emerald-300/90 text-xs">
                        {selectedAdminUser.email || selectedAdminUser.clerkId}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">الدور</label>
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="admin">مدير</option>
                <option value="editor">محرر</option>
                <option value="viewer">مشاهد</option>
                <option value="all_families_admin">مدير كل العائلات في القرية</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddFamilyAdmin}
            disabled={adminActionLoading || !selectedAdminUser}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            {adminActionLoading ? "جاري التنفيذ..." : "منح صلاحية"}
          </button>

          <div className="pt-2 border-t border-slate-700">
            <h3 className="text-white font-semibold mb-3">المديرون الحاليون</h3>
            {adminsLoading ? (
              <p className="text-slate-400 text-sm">جاري تحميل المديرين...</p>
            ) : familyAdmins.length === 0 ? (
              <p className="text-slate-400 text-sm">لا يوجد مديرون مضافون لهذه العائلة بعد.</p>
            ) : (
              <div className="space-y-2">
                {familyAdmins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between gap-3 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{admin.clerkId}</p>
                      <p className="text-slate-300 text-xs">الدور: {getAdminRoleLabel(admin.role)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFamilyAdmin(admin.clerkId)}
                      disabled={adminActionLoading}
                      className="p-2 text-slate-300 hover:text-red-400 hover:bg-slate-600 rounded transition"
                      title="سحب الصلاحية"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Family Tree */}
      {(canCreateCurrentRelationship || canDeleteCurrentRelationship) && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
          <div>
            <h3 className="text-xl font-bold text-white">إدارة العلاقات بين الأفراد</h3>
            <p className="text-slate-400 text-sm mt-1">
              اختر نوع الربط بشكل مباشر (أب، أم، ابن/ابنة، زوج/زوجة) ثم اختر الشخص.
            </p>
          </div>

          {relationError && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
              {relationError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">الفرد الأساسي</label>
              <select
                value={selectedMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  setSelectedRelatedMemberId("");
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">اختر فرداً</option>
                {Array.isArray(members) &&
                  members.map((member: any) => (
                    <option key={member.id} value={member.id}>
                      {getMemberOptionLabel(member, members)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">الفرد المرتبط</label>
              <select
                value={selectedRelatedMemberId}
                onChange={(e) => setSelectedRelatedMemberId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">اختر فرداً</option>
                {availableRelatedMembers.map((related: any) => (
                  <option key={related.id} value={related.id}>
                    {getMemberOptionLabel(related, availableRelatedMembers)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">نوع الربط المطلوب</label>
              <select
                value={relationshipIntent}
                onChange={(e) => {
                  setRelationshipIntent(e.target.value as RelationshipIntent);
                  setSelectedRelatedMemberId("");
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="FATHER">ربط أب للفرد الأساسي</option>
                <option value="MOTHER">ربط أم للفرد الأساسي</option>
                <option value="CHILD">ربط ابن/ابنة للفرد الأساسي</option>
                <option value="SPOUSE">ربط زوج/زوجة للفرد الأساسي</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
            {relationshipPreviewText}
          </div>

          {canCreateCurrentRelationship && (
            <button
              type="button"
              onClick={handleCreateRelationship}
              disabled={isSavingRelation || !selectedMemberId || !selectedRelatedMemberId}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              {isSavingRelation ? "جاري الإضافة..." : "إضافة العلاقة"}
            </button>
          )}

          <div className="pt-2 border-t border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h4 className="text-white font-semibold">علاقات الفرد الأساسي</h4>

              <select
                value={relationshipFilter}
                onChange={(e) =>
                  setRelationshipFilter(
                    e.target.value as "ALL" | "PARENTS" | "CHILDREN" | "SPOUSES"
                  )
                }
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="ALL">كل العلاقات ({relationshipCounts.all})</option>
                <option value="PARENTS">الآباء/الأمهات فقط ({relationshipCounts.parents})</option>
                <option value="CHILDREN">الأبناء فقط ({relationshipCounts.children})</option>
                <option value="SPOUSES">الأزواج فقط ({relationshipCounts.spouses})</option>
              </select>
            </div>

            {relationsLoading ? (
              <p className="text-slate-400 text-sm">جاري تحميل العلاقات...</p>
            ) : !selectedMemberId ? (
              <p className="text-slate-400 text-sm">اختر فرداً أساسياً لعرض علاقاته.</p>
            ) : filteredMemberRelationships.length === 0 ? (
              <p className="text-slate-400 text-sm">لا توجد علاقات مسجلة حالياً.</p>
            ) : (
              <div className="space-y-2">
                {filteredMemberRelationships.map((relationship) => {
                  const relatedMember =
                    relationship.fromMemberId === selectedMemberId
                      ? relationship.toMember
                      : relationship.fromMember;

                  return (
                    <div
                      key={relationship.id}
                      className="flex items-center justify-between gap-3 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">
                          {relationshipLabel(relationship, selectedMemberId)}
                        </p>
                        <p className="text-slate-300 text-sm">
                          {getMemberDisplayName(relatedMember)}
                        </p>
                      </div>

                      {canDeleteCurrentRelationship && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRelationship(relationship.id)}
                          disabled={isDeletingRelation}
                          className="p-2 text-slate-300 hover:text-red-400 hover:bg-slate-600 rounded transition"
                          title="حذف العلاقة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
