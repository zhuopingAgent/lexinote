"use client";

import { type FormEvent, useEffect, useState } from "react";
import type { AppView } from "@/app/lib/app-view";
import type {
  AddCollectionWordsResponse,
  CollectionListResponse,
  CollectionResponse,
  CollectionSummary,
} from "@/shared/types/api";

type ApiError = {
  error?: {
    message?: string;
  };
};

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

export function useCollections(activeView: AppView) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [collectionName, setCollectionName] = useState("");
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState("");
  const [editingCollectionAutoFilterEnabled, setEditingCollectionAutoFilterEnabled] =
    useState(false);
  const [editingCollectionAutoFilterCriteria, setEditingCollectionAutoFilterCriteria] =
    useState("");
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [busyCollectionId, setBusyCollectionId] = useState<number | null>(null);
  const [hasLoadedCollections, setHasLoadedCollections] = useState(false);

  useEffect(() => {
    if (activeView === "collections" && !hasLoadedCollections && !isCollectionsLoading) {
      void loadCollections();
    }
  }, [activeView, hasLoadedCollections, isCollectionsLoading]);

  useEffect(() => {
    const shouldPollCollections =
      hasLoadedCollections &&
      collections.some(
        (collection) =>
          collection.autoFilterSyncStatus === "pending" ||
          collection.autoFilterSyncStatus === "running"
      );

    if (!shouldPollCollections) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadCollections({ silent: true });
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [collections, hasLoadedCollections]);

  async function loadCollections(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    if (!silent) {
      setCollectionError(null);
      setIsCollectionsLoading(true);
    }

    try {
      const response = await fetch("/api/collections");

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as CollectionListResponse;
      setCollections(payload.collections);
      setHasLoadedCollections(true);
    } catch (collectionLoadError) {
      const message =
        collectionLoadError instanceof Error
          ? collectionLoadError.message
          : "发生了意外错误";
      if (!silent) {
        setCollectionError(message);
      }
    } finally {
      if (!silent) {
        setIsCollectionsLoading(false);
      }
    }
  }

  async function ensureCollectionsLoaded() {
    if (hasLoadedCollections || isCollectionsLoading) {
      return;
    }

    await loadCollections();
  }

  async function onAddOverviewWordToCollection(
    collectionId: number,
    wordId: number
  ): Promise<"added" | "already_exists"> {
    if (!isPositiveInteger(collectionId) || !isPositiveInteger(wordId)) {
      throw new Error("当前词条或 collection 信息无效，请刷新页面后重试。");
    }

    const response = await fetch(`/api/collections/${collectionId}/words/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wordIds: [wordId],
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(payload.error?.message || "请求失败");
    }

    const payload = (await response.json()) as AddCollectionWordsResponse;

    if (payload.addedCount > 0) {
      setCollections((currentCollections) =>
        currentCollections.map((collection) =>
          collection.collectionId === collectionId
            ? {
                ...collection,
                wordCount: collection.wordCount + payload.addedCount,
              }
            : collection
        )
      );

      return "added";
    }

    return "already_exists";
  }

  async function onCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!collectionName.trim()) {
      setCollectionError("请输入 collection 名称。");
      return;
    }

    setCollectionError(null);
    setIsCreatingCollection(true);

    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: collectionName.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as CollectionResponse;
      setCollections((currentCollections) => [payload.collection, ...currentCollections]);
      setCollectionName("");
      setHasLoadedCollections(true);
    } catch (collectionCreateError) {
      const message =
        collectionCreateError instanceof Error
          ? collectionCreateError.message
          : "发生了意外错误";
      setCollectionError(message);
    } finally {
      setIsCreatingCollection(false);
    }
  }

  function onStartEditingCollection(collection: CollectionSummary) {
    setCollectionError(null);
    setEditingCollectionId(collection.collectionId);
    setEditingCollectionName(collection.name);
    setEditingCollectionAutoFilterEnabled(collection.autoFilterEnabled);
    setEditingCollectionAutoFilterCriteria(collection.autoFilterCriteria);
  }

  function onCancelEditingCollection() {
    setEditingCollectionId(null);
    setEditingCollectionName("");
    setEditingCollectionAutoFilterEnabled(false);
    setEditingCollectionAutoFilterCriteria("");
  }

  async function onSaveCollectionUpdate(
    event: FormEvent<HTMLFormElement>,
    collectionId: number
  ) {
    event.preventDefault();

    if (!editingCollectionName.trim()) {
      setCollectionError("请输入 collection 名称。");
      return;
    }

    if (
      editingCollectionAutoFilterEnabled &&
      !editingCollectionAutoFilterCriteria.trim()
    ) {
      setCollectionError("开启 AI 自动筛选时，请填写筛选条件。");
      return;
    }

    setCollectionError(null);
    setBusyCollectionId(collectionId);

    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingCollectionName.trim(),
          autoFilterEnabled: editingCollectionAutoFilterEnabled,
          autoFilterCriteria: editingCollectionAutoFilterCriteria.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as CollectionResponse;
      setCollections((currentCollections) =>
        currentCollections.map((collection) =>
          collection.collectionId === collectionId ? payload.collection : collection
        )
      );
      onCancelEditingCollection();
    } catch (collectionUpdateError) {
      const message =
        collectionUpdateError instanceof Error
          ? collectionUpdateError.message
          : "发生了意外错误";
      setCollectionError(message);
    } finally {
      setBusyCollectionId(null);
    }
  }

  async function onDeleteCollection(collectionId: number) {
    const confirmed = window.confirm("确认删除这个 collection 吗？");
    if (!confirmed) {
      return;
    }

    setCollectionError(null);
    setBusyCollectionId(collectionId);

    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      setCollections((currentCollections) =>
        currentCollections.filter((collection) => collection.collectionId !== collectionId)
      );

      if (editingCollectionId === collectionId) {
        onCancelEditingCollection();
      }
    } catch (collectionDeleteError) {
      const message =
        collectionDeleteError instanceof Error
          ? collectionDeleteError.message
          : "发生了意外错误";
      setCollectionError(message);
    } finally {
      setBusyCollectionId(null);
    }
  }

  async function onResyncCollection(collectionId: number) {
    setCollectionError(null);
    setBusyCollectionId(collectionId);

    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resyncAutoFilter: true,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as CollectionResponse;
      setCollections((currentCollections) =>
        currentCollections.map((collection) =>
          collection.collectionId === collectionId ? payload.collection : collection
        )
      );
    } catch (collectionResyncError) {
      const message =
        collectionResyncError instanceof Error
          ? collectionResyncError.message
          : "发生了意外错误";
      setCollectionError(message);
    } finally {
      setBusyCollectionId(null);
    }
  }

  return {
    collections,
    collectionName,
    setCollectionName,
    collectionError,
    editingCollectionId,
    editingCollectionName,
    setEditingCollectionName,
    editingCollectionAutoFilterEnabled,
    setEditingCollectionAutoFilterEnabled,
    editingCollectionAutoFilterCriteria,
    setEditingCollectionAutoFilterCriteria,
    isCollectionsLoading,
    isCreatingCollection,
    busyCollectionId,
    hasLoadedCollections,
    ensureCollectionsLoaded,
    onAddOverviewWordToCollection,
    onCreateCollection,
    onStartEditingCollection,
    onCancelEditingCollection,
    onSaveCollectionUpdate,
    onDeleteCollection,
    onResyncCollection,
  };
}
