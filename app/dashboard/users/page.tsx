"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { usePermissions } from "@/lib/hooks/use-permissions";

type SearchableUser = {
  clerkId: string;
  fullName: string;
  email: string;
  imageUrl?: string;
};

type FamilyItem = {
  id: string;
  name: string;
  villageId: string;
};

type UserAdminMapping = {
  id: string;
  clerkId: string;
  familyId: string;
  role: string;
  family?: {
    id: string;
    name: string;
    villageId: string;
    village?: {
      id: string;
      name: string;
    };
  };
};

const roleOptions = [
  { value: "admin", label: "مدير" },
  { value: "editor", label: "محرر" },
  { value: "viewer", label: "مشاهد" },
];

export default function UsersManagementPage() {
  const router = useRouter();
  const { loading: permissionsLoading, isSuperAdmin } = usePermissions();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [usersQuery, setUsersQuery] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userResults, setUserResults] = useState<SearchableUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchableUser | null>(null);
  const [families, setFamilies] = useState<FamilyItem[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [selectedRole, setSelectedRole] = useState("admin");
  const [mappings, setMappings] = useState<UserAdminMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentVillageId = localStorage.getItem("selectedVillageId");
    if (currentVillageId) {
      setVillageId(currentVillageId);
    }
  }, []);

  useEffect(() => {
    if (!villageId || !isSuperAdmin) {
      setFamilies([]);
      return;
    }

    let mounted = true;

    const loadFamilies = async () => {
      try {
        setFamiliesLoading(true);
        const response = await fetch(
          `/api/families?villageId=${encodeURIComponent(villageId)}&sort=name-asc`
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "تعذر تحميل العائلات");
        }

        if (!mounted) {
          return;
        }

        const items = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.items)
            ? payload.data.items
            : [];

        setFamilies(items);
      } catch (error) {
        if (mounted) {
          setFamilies([]);
          setMessage(error instanceof Error ? error.message : "تعذر تحميل العائلات");
        }
      } finally {
        if (mounted) {
          setFamiliesLoading(false);
        }
      }
    };

    loadFamilies();

    return () => {
      mounted = false;
    };
  }, [villageId, isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin || selectedUser || usersQuery.trim().length < 2) {
      if (!selectedUser) {
        setUserResults([]);
      }
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setUsersLoading(true);
        setUsersError(null);
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(usersQuery.trim())}&limit=8`
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "تعذر البحث عن المستخدمين");
        }

        setUserResults(Array.isArray(payload?.data) ? payload.data : []);
      } catch (error) {
        setUserResults([]);
        setUsersError(error instanceof Error ? error.message : "تعذر البحث عن المستخدمين");
      } finally {
        setUsersLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [usersQuery, isSuperAdmin, selectedUser]);

  useEffect(() => {
    if (!selectedUser || !isSuperAdmin) {
      setMappings([]);
      return;
    }

    let mounted = true;

    const loadMappings = async () => {
      try {
        setMappingsLoading(true);
        setMessage(null);
        const villageFilter = villageId
          ? `?villageId=${encodeURIComponent(villageId)}`
          : "";
        const response = await fetch(
          `/api/users/${encodeURIComponent(selectedUser.clerkId)}/family-admins${villageFilter}`
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "تعذر تحميل صلاحيات المستخدم");
        }

        if (mounted) {
          setMappings(Array.isArray(payload?.data) ? payload.data : []);
        }
      } catch (error) {
        if (mounted) {
          setMappings([]);
          setMessage(error instanceof Error ? error.message : "تعذر تحميل صلاحيات المستخدم");
        }
      } finally {
        if (mounted) {
          setMappingsLoading(false);
        }
      }
    };

    loadMappings();

    return () => {
      mounted = false;
    };
  }, [selectedUser, villageId, isSuperAdmin]);

  const assignedFamilyIds = useMemo(
    () => new Set(mappings.map((item) => item.familyId)),
    [mappings]
  );

  const availableFamilies = useMemo(
    () => families.filter((family) => !assignedFamilyIds.has(family.id)),
    [families, assignedFamilyIds]
  );

  const handleAssign = async () => {
    if (!selectedUser) {
      setMessage("اختر مستخدماً أولاً");
      return;
    }

    if (!selectedFamilyId) {
      setMessage("اختر عائلة لإضافة الصلاحية");
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      const response = await fetch(`/api/families/${selectedFamilyId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkId: selectedUser.clerkId,
          role: selectedRole,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "تعذر إضافة الصلاحية");
      }

      setSelectedFamilyId("");
      setSelectedRole("admin");
      setMessage("تمت إضافة الصلاحية بنجاح");

      const refreshed = await fetch(
        `/api/users/${encodeURIComponent(selectedUser.clerkId)}/family-admins${villageId ? `?villageId=${encodeURIComponent(villageId)}` : ""}`
      );
      const refreshedPayload = await refreshed.json();
      setMappings(Array.isArray(refreshedPayload?.data) ? refreshedPayload.data : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إضافة الصلاحية");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (familyIdToRemove: string) => {
    if (!selectedUser) {
      return;
    }

    if (!confirm("هل تريد إزالة صلاحية هذا المستخدم من هذه العائلة؟")) {
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      const response = await fetch(`/api/families/${familyIdToRemove}/admins`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: selectedUser.clerkId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "تعذر إزالة الصلاحية");
      }

      setMappings((prev) => prev.filter((item) => item.familyId !== familyIdToRemove));
      setMessage("تمت إزالة الصلاحية بنجاح");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إزالة الصلاحية");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (familyIdToUpdate: string, role: string) => {
    if (!selectedUser) {
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      const response = await fetch(`/api/families/${familyIdToUpdate}/admins`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: selectedUser.clerkId, role }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "تعذر تحديث الدور");
      }

      setMappings((prev) =>
        prev.map((item) =>
          item.familyId === familyIdToUpdate ? { ...item, role } : item
        )
      );
      setMessage("تم تحديث الدور بنجاح");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحديث الدور");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [permissionsLoading, isSuperAdmin, router]);

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-8 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" />
        جاري التحقق من الصلاحيات...
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">إدارة المستخدمين</h1>
          <p className="mt-1 text-slate-400">
            ابحث عن أي مستخدم مسجل، ثم امنحه صلاحية إدارة عائلة أو عدل دوره أو أزل الصلاحية.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">
          <ShieldCheck className="h-4 w-4" />
          Super Admin فقط
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Search className="h-5 w-5 text-blue-400" />
            <h2 className="text-xl font-bold">البحث عن مستخدم</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">الاسم أو البريد الإلكتروني</label>
              <input
                type="text"
                value={selectedUser ? `${selectedUser.fullName} - ${selectedUser.email}` : usersQuery}
                onChange={(event) => {
                  setSelectedUser(null);
                  setUsersQuery(event.target.value);
                  setMessage(null);
                }}
                placeholder="ابحث عن مستخدم مسجل في النظام..."
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 outline-none focus:border-blue-500"
              />
            </div>

            {usersLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري البحث...
              </div>
            )}

            {usersError && <p className="text-sm text-red-400">{usersError}</p>}

            {!selectedUser && userResults.length > 0 && (
              <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                {userResults.map((user) => (
                  <button
                    key={user.clerkId}
                    type="button"
                    onClick={() => {
                      setSelectedUser(user);
                      setUsersQuery(user.fullName || user.email);
                      setUserResults([]);
                      setMessage(null);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-right transition hover:border-blue-500/40 hover:bg-slate-700"
                  >
                    <div>
                      <p className="font-medium text-white">{user.fullName}</p>
                      <p className="text-sm text-slate-400">{user.email}</p>
                    </div>
                    <Users className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="font-semibold">المستخدم المحدد</p>
                <p className="mt-1">{selectedUser.fullName}</p>
                <p className="text-emerald-200">{selectedUser.email}</p>
                <p className="mt-2 font-mono text-xs text-emerald-200 break-all">{selectedUser.clerkId}</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div className="mb-4 flex items-center gap-2 text-white">
            <UserCog className="h-5 w-5 text-fuchsia-400" />
            <h2 className="text-xl font-bold">إدارة الصلاحيات</h2>
          </div>

          {!villageId ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
              <p className="font-semibold">اختر قرية أولاً</p>
              <p className="mt-1 text-sm text-amber-200">
                لأن الصلاحيات مرتبطة بالعائلات داخل القرية المختارة حالياً.
              </p>
              <Link href="/dashboard/villages" className="mt-3 inline-block text-sm font-medium text-amber-50 underline underline-offset-4">
                الانتقال إلى صفحة القرى
              </Link>
            </div>
          ) : !selectedUser ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-6 text-center text-slate-400">
              اختر مستخدماً أولاً لعرض العائلات المعيّن عليها وإدارة صلاحياته.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_auto]">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">العائلة</label>
                  <select
                    value={selectedFamilyId}
                    onChange={(event) => setSelectedFamilyId(event.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white outline-none focus:border-blue-500"
                    disabled={familiesLoading || actionLoading}
                  >
                    <option value="">اختر عائلة لإضافة الصلاحية</option>
                    {availableFamilies.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">الدور</label>
                  <select
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white outline-none focus:border-blue-500"
                    disabled={actionLoading}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={actionLoading || !selectedFamilyId}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-900/50"
                  >
                    {actionLoading ? "جاري الحفظ..." : "إضافة صلاحية"}
                  </button>
                </div>
              </div>

              {message && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-200">
                  {message}
                </div>
              )}

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">العائلات المعيّن عليها</h3>
                  {mappingsLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                </div>

                {mappings.length === 0 ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-5 text-sm text-slate-400">
                    لا توجد صلاحيات حالية لهذا المستخدم داخل القرية المختارة.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-semibold text-white">{mapping.family?.name || "عائلة غير معروفة"}</p>
                            <p className="text-sm text-slate-400">
                              {mapping.family?.village?.name || "قرية غير معروفة"}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select
                              value={mapping.role}
                              onChange={(event) => handleRoleChange(mapping.familyId, event.target.value)}
                              disabled={actionLoading}
                              className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                            >
                              {roleOptions.map((role) => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemove(mapping.familyId)}
                              disabled={actionLoading}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" />
                              إزالة
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}