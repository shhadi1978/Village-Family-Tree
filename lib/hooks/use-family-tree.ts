import { useState, useCallback } from "react";
import { useApi } from "./use-api";
import type { FamilyTreeNode } from "@/lib/tree-logic";

/**
 * Custom hook for fetching and managing family trees
 */
export function useFamilyTree() {
  const { data, loading, error, execute } = useApi<FamilyTreeNode>();
  const [treeData, setTreeData] = useState<FamilyTreeNode | null>(null);

  const fetchTree = useCallback(
    async (memberId: string) => {
      try {
        // This would require a new API endpoint to fetch tree
        const response = await fetch(`/api/tree/${memberId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch family tree");
        }

        const result = await response.json();
        setTreeData(result.data);
        return result.data;
      } catch (err) {
        console.error("Error fetching tree:", err);
        throw err;
      }
    },
    []
  );

  return {
    treeData,
    loading,
    error,
    fetchTree,
  };
}
