import { useState, useCallback } from "react";

interface UseApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (url: string, options?: UseApiOptions & { body?: unknown }) => Promise<T>;
}

/**
 * Custom hook for making API calls with loading and error states
 */
export function useApi<T = unknown>(): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (
      url: string,
      options: UseApiOptions & { body?: unknown } = {}
    ): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url, {
          method: options.method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          body:
            options.body && options.method !== "GET"
              ? JSON.stringify(options.body)
              : undefined,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP Error: ${response.status}`
          );
        }

        const result = await response.json();
        setData(result.data);
        return result.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, error, execute };
}

/**
 * Custom hook specifically for fetching members
 */
export function useMembers() {
  const { data, loading, error, execute } = useApi();

  const getMembers = useCallback(
    async (
      familyId?: string,
      villageId?: string,
      search?: string,
      page?: number,
      pageSize?: number
    ) => {
      const params = new URLSearchParams();
      if (familyId) params.append("familyId", familyId);
      if (villageId) params.append("villageId", villageId);
      if (search) params.append("search", search);
      if (page) params.append("page", String(page));
      if (pageSize) params.append("pageSize", String(pageSize));

      return execute(`/api/members?${params.toString()}`);
    },
    [execute]
  );

  const getMember = useCallback(
    async (memberId: string) => {
      return execute(`/api/members/${memberId}`);
    },
    [execute]
  );

  const createMember = useCallback(
    async (memberData: {
      firstName: string;
      lastName: string;
      nickname?: string;
      gender: string;
      familyId: string;
      villageId: string;
      fatherId?: string;
      motherId?: string;
      isFounder?: boolean;
      dateOfBirth?: string;
      dateOfDeath?: string;
      bio?: string;
      photoUrl?: string;
    }) => {
      return execute("/api/members", {
        method: "POST",
        body: memberData,
      });
    },
    [execute]
  );

  const updateMember = useCallback(
    async (memberId: string, updates: Partial<unknown>) => {
      return execute(`/api/members/${memberId}`, {
        method: "PUT",
        body: updates,
      });
    },
    [execute]
  );

  const deleteMember = useCallback(
    async (memberId: string) => {
      return execute(`/api/members/${memberId}`, {
        method: "DELETE",
      });
    },
    [execute]
  );

  return {
    members: data,
    loading,
    error,
    getMembers,
    getMember,
    createMember,
    updateMember,
    deleteMember,
  };
}

/**
 * Custom hook for managing relationships
 */
export function useRelationships() {
  const { data, loading, error, execute } = useApi();

  const getRelationships = useCallback(
    async (memberId: string, type?: string) => {
      const params = new URLSearchParams({ memberId });
      if (type) params.append("type", type);

      return execute(`/api/relationships?${params.toString()}`);
    },
    [execute]
  );

  const createRelationship = useCallback(
    async (relationshipData: {
      fromMemberId: string;
      toMemberId: string;
      type: string;
      villageId: string;
      replaceExistingParent?: boolean;
    }) => {
      return execute("/api/relationships", {
        method: "POST",
        body: relationshipData,
      });
    },
    [execute]
  );

  const deleteRelationship = useCallback(
    async (relationshipId: string) => {
      return execute(`/api/relationships/${relationshipId}`, {
        method: "DELETE",
      });
    },
    [execute]
  );

  return {
    relationships: data,
    loading,
    error,
    getRelationships,
    createRelationship,
    deleteRelationship,
  };
}

/**
 * Custom hook for managing families
 */
export function useFamilies() {
  const { data, loading, error, execute } = useApi();

  type FamilySortParam = "members-desc" | "members-asc" | "name-asc";

  const getFamilies = useCallback(
    async (
      villageId: string,
      includeStats = false,
      search?: string,
      page?: number,
      pageSize?: number,
      sort: FamilySortParam = "members-desc"
    ) => {
      const params = new URLSearchParams({ villageId });
      if (includeStats) params.append("includeStats", "true");
      params.append("sort", sort);
      if (search && search.trim().length > 0) {
        params.append("search", search.trim());
      }
      if (page) params.append("page", String(page));
      if (pageSize) params.append("pageSize", String(pageSize));

      return execute(`/api/families?${params.toString()}`);
    },
    [execute]
  );

  const getFamily = useCallback(
    async (familyId: string) => {
      return execute(`/api/families/${familyId}`);
    },
    [execute]
  );

  const createFamily = useCallback(
    async (familyData: {
      name: string;
      slug: string;
      villageId: string;
      description?: string;
      photoUrl?: string;
    }) => {
      return execute("/api/families", {
        method: "POST",
        body: familyData,
      });
    },
    [execute]
  );

  const updateFamily = useCallback(
    async (familyId: string, updates: Partial<unknown>) => {
      return execute(`/api/families/${familyId}`, {
        method: "PUT",
        body: updates,
      });
    },
    [execute]
  );

  const deleteFamily = useCallback(
    async (familyId: string) => {
      return execute(`/api/families/${familyId}`, {
        method: "DELETE",
      });
    },
    [execute]
  );

  return {
    families: data,
    loading,
    error,
    getFamilies,
    getFamily,
    createFamily,
    updateFamily,
    deleteFamily,
  };
}
