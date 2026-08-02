"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { AppView } from "@/app/lib/app-view";
import {
  getErrorMessage,
  isAiQuotaErrorMessage,
  isAiQuotaExhaustedError,
  readJson,
} from "@/app/lib/api-client";
import {
  isAutoFilterSyncActive,
  isAutoFilterSyncFailed,
} from "@/app/lib/collection-status";
import { isPositiveInteger } from "@/app/lib/number";
import type {
  AddCollectionWordResponse,
  AddCollectionWordsResponse,
  CollectionListResponse,
  CollectionResponse,
  CollectionSummary,
} from "@/shared/types/api";

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
  const [aiApiErrorMessage, setAiApiErrorMessage] = useState<string | null>(null);
  const notifiedAiQuotaCollectionIdsRef = useRef(new Set<number>());

  const notifyAiQuotaAutoFilterFailures = useCallback(
    (nextCollections: CollectionSummary[]) => {
      const failedCollection = nextCollections.find(
        (collection) =>
          isAutoFilterSyncFailed(collection.autoFilterSyncStatus) &&
          isAiQuotaErrorMessage(collection.autoFilterLastError) &&
          !notifiedAiQuotaCollectionIdsRef.current.has(collection.collectionId)
      );

      if (!failedCollection) {
        return;
      }

      notifiedAiQuotaCollectionIdsRef.current.add(failedCollection.collectionId);
      setAiApiErrorMessage(failedCollection.autoFilterLastError);
    },
    []
  );

  const loadCollections = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!silent) {
        setCollectionError(null);
        setIsCollectionsLoading(true);
      }

      try {
        const response = await fetch("/api/collections");

        const payload = await readJson<CollectionListResponse>(response);
        setCollections(payload.collections);
        setHasLoadedCollections(true);
        notifyAiQuotaAutoFilterFailures(payload.collections);
      } catch (collectionLoadError) {
        const message = getErrorMessage(collectionLoadError, "发生了意外错误");
        if (isAiQuotaExhaustedError(collectionLoadError)) {
          setAiApiErrorMessage(message);
        }
        if (!silent) {
          setCollectionError(message);
        }
      } finally {
        if (!silent) {
          setIsCollectionsLoading(false);
        }
      }
    },
    [notifyAiQuotaAutoFilterFailures]
  );

  useEffect(() => {
    if (activeView === "collections" && !hasLoadedCollections && !isCollectionsLoading) {
      void loadCollections();
    }
  }, [activeView, hasLoadedCollections, isCollectionsLoading, loadCollections]);

  useEffect(() => {
    const shouldPollCollections =
      hasLoadedCollections &&
      collections.some((collection) =>
        isAutoFilterSyncActive(collection.autoFilterSyncStatus)
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
  }, [collections, hasLoadedCollections, loadCollections]);

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
      throw new Error("当前词条或单词本信息无效，请刷新页面后重试。");
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

    const payload = await readJson<AddCollectionWordsResponse>(response);

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

  async function onAddDictionaryEntryToCollection(
    collectionId: number,
    word: string,
    pronunciation: string
  ): Promise<"added" | "already_exists"> {
    if (!isPositiveInteger(collectionId) || !word.trim() || !pronunciation.trim()) {
      throw new Error("当前词条或单词本信息无效，请刷新页面后重试。");
    }

    const response = await fetch(`/api/collections/${collectionId}/words`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        word: word.trim(),
        pronunciation: pronunciation.trim(),
      }),
    });

    const payload = await readJson<AddCollectionWordResponse>(response);

    if (payload.status === "requires_selection") {
      throw new Error("这个词有多个读音，请先选择一个具体词条。");
    }

    if (payload.status === "added") {
      setCollections((currentCollections) =>
        currentCollections.map((collection) =>
          collection.collectionId === collectionId
            ? {
                ...collection,
                wordCount: collection.wordCount + 1,
              }
            : collection
        )
      );
    }

    return payload.status;
  }

  async function onCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!collectionName.trim()) {
      setCollectionError("请输入单词本名称。");
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

      const payload = await readJson<CollectionResponse>(response);
      setCollections((currentCollections) => [payload.collection, ...currentCollections]);
      setCollectionName("");
      setHasLoadedCollections(true);
    } catch (collectionCreateError) {
      const message = getErrorMessage(collectionCreateError, "发生了意外错误");
      if (isAiQuotaExhaustedError(collectionCreateError)) {
        setAiApiErrorMessage(message);
      }
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
      setCollectionError("请输入单词本名称。");
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

      const payload = await readJson<CollectionResponse>(response);
      setCollections((currentCollections) =>
        currentCollections.map((collection) =>
          collection.collectionId === collectionId ? payload.collection : collection
        )
      );
      onCancelEditingCollection();
    } catch (collectionUpdateError) {
      const message = getErrorMessage(collectionUpdateError, "发生了意外错误");
      if (isAiQuotaExhaustedError(collectionUpdateError)) {
        setAiApiErrorMessage(message);
      }
      setCollectionError(message);
    } finally {
      setBusyCollectionId(null);
    }
  }

  async function onDeleteCollection(collectionId: number) {
    const confirmed = window.confirm("确认删除这个单词本吗？");
    if (!confirmed) {
      return;
    }

    setCollectionError(null);
    setBusyCollectionId(collectionId);

    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: "DELETE",
      });

      await readJson<{ ok?: boolean }>(response);

      setCollections((currentCollections) =>
        currentCollections.filter((collection) => collection.collectionId !== collectionId)
      );

      if (editingCollectionId === collectionId) {
        onCancelEditingCollection();
      }
    } catch (collectionDeleteError) {
      const message = getErrorMessage(collectionDeleteError, "发生了意外错误");
      if (isAiQuotaExhaustedError(collectionDeleteError)) {
        setAiApiErrorMessage(message);
      }
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

      const payload = await readJson<CollectionResponse>(response);
      setCollections((currentCollections) =>
        currentCollections.map((collection) =>
          collection.collectionId === collectionId ? payload.collection : collection
        )
      );
    } catch (collectionResyncError) {
      const message = getErrorMessage(collectionResyncError, "发生了意外错误");
      if (isAiQuotaExhaustedError(collectionResyncError)) {
        setAiApiErrorMessage(message);
      }
      setCollectionError(message);
    } finally {
      setBusyCollectionId(null);
    }
  }

  function onDismissAiApiError() {
    setAiApiErrorMessage(null);
  }

  return {
    collections,
    collectionName,
    setCollectionName,
    collectionError,
    aiApiErrorMessage,
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
    onAddDictionaryEntryToCollection,
    onCreateCollection,
    onStartEditingCollection,
    onCancelEditingCollection,
    onSaveCollectionUpdate,
    onDeleteCollection,
    onResyncCollection,
    onDismissAiApiError,
  };
}
