"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import MemberForm from "@/components/MemberForm";
import { useMembers, useRelationships } from "@/lib/hooks/use-api";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { getMemberDisplayName, getMemberOptionLabel } from "@/lib/member-display";

type MemberModel = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  familyId: string;
  villageId: string;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
};

type RelatedMember = {
  id: string;
  fullName?: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
  familyId?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
};

type RelationshipIntent = "FATHER" | "MOTHER" | "CHILD" | "SPOUSE";

type RelationshipRecord = {
  id: string;
  type: "PARENT" | "SPOUSE";
  fromMemberId: string;
  toMemberId: string;
  fromMember?: RelatedMember;
  toMember?: RelatedMember;
};

type MemberRelationshipsResponse = {
  from?: RelationshipRecord[];
  to?: RelationshipRecord[];
};

function getRelationshipLabel(
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

function formatDateInput(dateValue?: string | null): string {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export default function MemberEditPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.memberId as string;
  const { getMember, getMembers } = useMembers();
  const { getRelationships, createRelationship, deleteRelationship } =
    useRelationships();
  const {
    canEditMember,
    canCreateRelationship,
    canDeleteRelationship,
    loading: permissionsLoading,
  } = usePermissions();

  const [member, setMember] = useState<MemberModel | null>(null);
  const [villageMembers, setVillageMembers] = useState<RelatedMember[]>([]);
  const [memberRelationships, setMemberRelationships] = useState<
    RelationshipRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [isSavingRelation, setIsSavingRelation] = useState(false);
  const [isDeletingRelation, setIsDeletingRelation] = useState(false);
  const [relationError, setRelationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relationshipIntent, setRelationshipIntent] = useState<RelationshipIntent>(
    "FATHER"
  );
  const [selectedRelatedMemberId, setSelectedRelatedMemberId] = useState("");
  // Change-parent inline state
  const [changingParent, setChangingParent] = useState<"FATHER" | "MOTHER" | null>(null);
  const [newParentId, setNewParentId] = useState("");
  const [isReplacingParent, setIsReplacingParent] = useState(false);

  const canEditCurrentMember = canEditMember(member?.familyId);
  const canCreateCurrentRelationship = canCreateRelationship(member?.familyId);
  const canDeleteCurrentRelationship = canDeleteRelationship(member?.familyId);

  useEffect(() => {
    const loadMember = async () => {
      try {
        const data = (await getMember(memberId)) as MemberModel;
        setMember(data);
      } catch (err) {
        console.error("Error loading member:", err);
        setError(err instanceof Error ? err.message : "تعذر تحميل بيانات الفرد");
      } finally {
        setLoading(false);
      }
    };

    if (memberId) {
      loadMember();
    }
  }, [memberId, getMember]);

  useEffect(() => {
    const loadRelationshipData = async () => {
      if (!member) {
        return;
      }

      setRelationsLoading(true);
      setRelationError(null);

      try {
        const [relationshipsData, villageMembersData] = await Promise.all([
          getRelationships(member.id),
          getMembers(undefined, member.villageId),
        ]);

        const relationshipsPayload =
          (relationshipsData as MemberRelationshipsResponse) || {};
        const from = Array.isArray(relationshipsPayload.from)
          ? relationshipsPayload.from
          : [];
        const to = Array.isArray(relationshipsPayload.to)
          ? relationshipsPayload.to
          : [];
        setMemberRelationships([...from, ...to]);

        const villagePayload = villageMembersData as
          | { members?: RelatedMember[] }
          | RelatedMember[];
        const villageMemberArray = Array.isArray(villagePayload)
          ? villagePayload
          : villagePayload?.members || [];
        setVillageMembers(villageMemberArray);
      } catch (err) {
        console.error("Error loading relationships:", err);
        setRelationError(
          err instanceof Error
            ? err.message
            : "تعذر تحميل علاقات الفرد"
        );
      } finally {
        setRelationsLoading(false);
      }
    };

    loadRelationshipData();
  }, [member, getRelationships, getMembers]);

  const availableRelatedMembers = useMemo(() => {
    if (!member) {
      return [];
    }

    return villageMembers.filter((candidate) => {
      if (candidate.id === member.id) {
        return false;
      }

      if (relationshipIntent === "FATHER") {
        return (
          candidate.gender === "MALE" && candidate.familyId === member.familyId
        );
      }

      if (relationshipIntent === "MOTHER") {
        return candidate.gender === "FEMALE";
      }

      if (relationshipIntent === "CHILD") {
        if (member.gender === "MALE") {
          // Father's lineage must stay in the same family.
          return candidate.familyId === member.familyId;
        }
        return true;
      }

      return true;
    });
  }, [villageMembers, member, relationshipIntent]);

  const currentFather = useMemo(() => {
    return memberRelationships.find(
      (r) =>
        r.type === "PARENT" &&
        r.toMemberId === member?.id &&
        (r.fromMember?.gender === "MALE" || r.fromMember?.gender === undefined)
    );
  }, [memberRelationships, member]);

  const currentMother = useMemo(() => {
    return memberRelationships.find(
      (r) =>
        r.type === "PARENT" &&
        r.toMemberId === member?.id &&
        r.fromMember?.gender === "FEMALE"
    );
  }, [memberRelationships, member]);

  const fatherCandidates = useMemo(() => {
    if (!member) return [];
    return villageMembers.filter(
      (c) => c.id !== member.id && c.gender === "MALE" && c.familyId === member.familyId
    );
  }, [villageMembers, member]);

  const motherCandidates = useMemo(() => {
    if (!member) return [];
    return villageMembers.filter(
      (c) => c.id !== member.id && c.gender === "FEMALE"
    );
  }, [villageMembers, member]);

  const relationshipPreviewText = useMemo(() => {
    if (!member) {
      return "";
    }

    if (!selectedRelatedMemberId) {
      return "اختر الشخص المرتبط لإظهار وصف العلاقة.";
    }

    const selected = availableRelatedMembers.find(
      (candidate) => candidate.id === selectedRelatedMemberId
    );
    const selectedName = getMemberDisplayName(selected);
    const currentName = getMemberDisplayName(member);

    if (relationshipIntent === "FATHER") {
      return `${selectedName} هو الأب لـ ${currentName}.`;
    }

    if (relationshipIntent === "MOTHER") {
      return `${selectedName} هي الأم لـ ${currentName}.`;
    }

    if (relationshipIntent === "CHILD") {
      return `${selectedName} هو ابن/ابنة لـ ${currentName}.`;
    }

    return `${selectedName} هو زوج/زوجة لـ ${currentName}.`;
  }, [member, selectedRelatedMemberId, availableRelatedMembers, relationshipIntent]);

  const handleCreateRelationship = async () => {
    if (!member || !selectedRelatedMemberId) {
      setRelationError("اختر فرداً لإضافة العلاقة");
      return;
    }

    setIsSavingRelation(true);
    setRelationError(null);

    try {
      const selected = availableRelatedMembers.find(
        (candidate) => candidate.id === selectedRelatedMemberId
      );

      if (!selected) {
        throw new Error("الشخص المختار غير صالح لهذه العلاقة");
      }

      let fromMemberId = member.id;
      let toMemberId = selectedRelatedMemberId;
      let type: "PARENT" | "SPOUSE" = "PARENT";

      if (relationshipIntent === "FATHER") {
        if (selected.gender !== "MALE") {
          throw new Error("يجب اختيار ذكر كرابط أب");
        }
        fromMemberId = selectedRelatedMemberId;
        toMemberId = member.id;
        type = "PARENT";
      } else if (relationshipIntent === "MOTHER") {
        if (selected.gender !== "FEMALE") {
          throw new Error("يجب اختيار أنثى كرابط أم");
        }
        fromMemberId = selectedRelatedMemberId;
        toMemberId = member.id;
        type = "PARENT";
      } else if (relationshipIntent === "CHILD") {
        if (member.gender === "OTHER") {
          throw new Error("لا يمكن إنشاء علاقة أبوة/أمومة لفرد بجنس غير محدد");
        }
        fromMemberId = member.id;
        toMemberId = selectedRelatedMemberId;
        type = "PARENT";
      } else {
        fromMemberId = member.id;
        toMemberId = selectedRelatedMemberId;
        type = "SPOUSE";
      }

      await createRelationship({
        fromMemberId,
        toMemberId,
        type,
        villageId: member.villageId,
      });

      const refreshed = (await getRelationships(
        member.id
      )) as MemberRelationshipsResponse;
      const from = Array.isArray(refreshed?.from) ? refreshed.from : [];
      const to = Array.isArray(refreshed?.to) ? refreshed.to : [];
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

  const handleReplaceParent = async () => {
    if (!member || !newParentId || !changingParent) return;

    const existing = changingParent === "FATHER" ? currentFather : currentMother;

    // Same parent selected — nothing to do
    if (existing && existing.fromMemberId === newParentId) {
      setRelationError("هذا الشخص هو الوالد الحالي بالفعل، لا يوجد تغيير.");
      return;
    }

    setIsReplacingParent(true);
    setRelationError(null);

    try {
      // Replace mode: server deletes previous same-gender parent atomically.
      await createRelationship({
        fromMemberId: newParentId,
        toMemberId: member.id,
        type: "PARENT",
        villageId: member.villageId,
        replaceExistingParent: true,
      });

      // Refresh relationships
      const refreshed = (await getRelationships(member.id)) as { from?: RelationshipRecord[]; to?: RelationshipRecord[] };
      const from = Array.isArray(refreshed?.from) ? refreshed.from : [];
      const to = Array.isArray(refreshed?.to) ? refreshed.to : [];
      setMemberRelationships([...from, ...to]);

      setChangingParent(null);
      setNewParentId("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر تغيير الوالد";
      const isDuplicate =
        msg.includes("Unique constraint") ||
        msg.includes("already exists") ||
        msg.includes("P2002");
      setRelationError(
        isDuplicate
          ? "هذا الشخص مرتبط بالفعل كوالد لهذا الفرد."
          : msg
      );
    } finally {
      setIsReplacingParent(false);
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

  const initialData = useMemo(() => {
    if (!member) {
      return undefined;
    }

    return {
      ...member,
      dateOfBirth: formatDateInput(member.dateOfBirth),
      dateOfDeath: formatDateInput(member.dateOfDeath),
    };
  }, [member]);

  if (permissionsLoading) {
    return <div className="text-slate-400">جاري التحقق من الصلاحيات...</div>;
  }

  if (loading) {
    return <div className="text-slate-400">جاري تحميل بيانات الفرد...</div>;
  }

  if (member && !canEditCurrentMember) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/families"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Link>

        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 text-yellow-200">
          لا تملك صلاحية تعديل هذا الفرد.
            <div>
              <h2 className="text-xl font-bold text-white">إدارة العلاقات (بشكل مبسط)</h2>
              <p className="text-slate-400 text-sm mt-1">
                اختر نوع الربط مباشرة ثم اختر الشخص، وسيتم إنشاء العلاقة تلقائياً.
              </p>
            </div>
    return (
            {/* ── Parents quick-change section ── */}
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 space-y-3">
              <h3 className="text-white font-semibold text-sm">الوالدان</h3>
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
              {relationError && changingParent && (
                <div className="bg-red-900 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
                  {relationError}
                </div>
              )}
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200">
              {/* Father row */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">الأب</p>
                    <p className="text-sm text-white">
                      {currentFather
                        ? getMemberDisplayName(currentFather.fromMember)
                        : <span className="text-slate-500 italic">غير محدد</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setChangingParent(changingParent === "FATHER" ? null : "FATHER");
                      setNewParentId("");
                      setRelationError(null);
                    }}
                    className="text-xs px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition"
                  >
                    {changingParent === "FATHER" ? "إلغاء" : "تغيير"}
                  </button>
          href={`/dashboard/families/${member.familyId}`}
                {changingParent === "FATHER" && canCreateCurrentRelationship && (
                  <div className="flex gap-2">
                    <select
                      value={newParentId}
                      onChange={(e) => setNewParentId(e.target.value)}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="">اختر الأب الجديد...</option>
                      {fatherCandidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {getMemberOptionLabel(c, fatherCandidates)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleReplaceParent}
                      disabled={!newParentId || isReplacingParent}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition"
                    >
                      {isReplacingParent ? "..." : "حفظ"}
                    </button>
                  </div>
                )}
              </div>
            <div className="flex items-center justify-between gap-3">
              {/* Mother row */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">الأم</p>
                    <p className="text-sm text-white">
                      {currentMother
                        ? getMemberDisplayName(currentMother.fromMember)
                        : <span className="text-slate-500 italic">غير محددة</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setChangingParent(changingParent === "MOTHER" ? null : "MOTHER");
                      setNewParentId("");
                      setRelationError(null);
                    }}
                    className="text-xs px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition"
                  >
                    {changingParent === "MOTHER" ? "إلغاء" : "تغيير"}
                  </button>
                </div>
                {changingParent === "MOTHER" && canCreateCurrentRelationship && (
                  <div className="flex gap-2">
                    <select
                      value={newParentId}
                      onChange={(e) => setNewParentId(e.target.value)}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="">اختر الأم الجديدة...</option>
                      {motherCandidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {getMemberOptionLabel(c, motherCandidates)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleReplaceParent}
                      disabled={!newParentId || isReplacingParent}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition"
                    >
                      {isReplacingParent ? "..." : "حفظ"}
                    </button>
                  </div>
                )}
              </div>
            )}
          {/* Mother row */}
            {relationError && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
                {relationError}
              </div>
            )}
                  {currentMother
            {canCreateCurrentRelationship && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      <option value="FATHER">ربط أب لهذا الفرد</option>
                      <option value="MOTHER">ربط أم لهذا الفرد</option>
                      <option value="CHILD">ربط ابن/ابنة لهذا الفرد</option>
                      <option value="SPOUSE">ربط زوج/زوجة لهذا الفرد</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-300 mb-1">اختر الشخص</label>
                    <select
                      value={selectedRelatedMemberId}
                      onChange={(e) => setSelectedRelatedMemberId(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">اختر فرداً</option>
                      {availableRelatedMembers.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {getMemberOptionLabel(candidate, availableRelatedMembers)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
                  {relationshipPreviewText}
                </div>

                <button
                  type="button"
                  onClick={handleCreateRelationship}
                  disabled={isSavingRelation || !selectedRelatedMemberId}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition"
                >
                  <Plus className="w-4 h-4" />
                  {isSavingRelation ? "جاري الإضافة..." : "إضافة العلاقة"}
                </button>
              </>
            )}

            <div className="pt-2 border-t border-slate-700">
              <h3 className="text-white font-semibold mb-3">العلاقات الحالية</h3>

              {relationsLoading ? (
                <p className="text-slate-400 text-sm">جاري تحميل العلاقات...</p>
              ) : memberRelationships.length === 0 ? (
                <p className="text-slate-400 text-sm">لا توجد علاقات مسجلة بعد.</p>
              ) : (
                <div className="space-y-2">
                  {memberRelationships.map((relationship) => {
                    const relatedMember =
                      relationship.fromMemberId === member.id
                        ? relationship.toMember
                        : relationship.fromMember;

                    return (
                      <div
                        key={relationship.id}
                        className="flex items-center justify-between gap-3 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">
                            {getRelationshipLabel(relationship, member.id)}
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
            {changingParent === "MOTHER" && (
                  disabled={!newParentId || isReplacingParent}
          </div>
          <Plus className="w-4 h-4" />
          {isSavingRelation ? "جاري الإضافة..." : "إضافة العلاقة"}
        </button>

        <div className="pt-2 border-t border-slate-700">
          <h3 className="text-white font-semibold mb-3">العلاقات الحالية</h3>

          {relationsLoading ? (
            <p className="text-slate-400 text-sm">جاري تحميل العلاقات...</p>
          ) : memberRelationships.length === 0 ? (
            <p className="text-slate-400 text-sm">لا توجد علاقات مسجلة بعد.</p>
          ) : (
            <div className="space-y-2">
              {memberRelationships.map((relationship) => {
                const relatedMember =
                  relationship.fromMemberId === member.id
                    ? relationship.toMember
                    : relationship.fromMember;

                return (
                  <div
                    key={relationship.id}
                    className="flex items-center justify-between gap-3 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">
                        {getRelationshipLabel(relationship, member.id)}
                      </p>
                      <p className="text-slate-300 text-sm">
                        {getMemberDisplayName(relatedMember)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRelationship(relationship.id)}
                      disabled={isDeletingRelation}
                      className="p-2 text-slate-300 hover:text-red-400 hover:bg-slate-600 rounded transition"
                      title="حذف العلاقة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
