import type { AutoFilterSyncStatus } from "@/shared/types/collections";

const ACTIVE_AUTO_FILTER_STATUSES = new Set<AutoFilterSyncStatus>([
  "pending",
  "running",
]);

const RESYNC_SUPPRESSED_AUTO_FILTER_STATUSES = new Set<AutoFilterSyncStatus>([
  "pending",
  "running",
  "failed",
]);

export function isAutoFilterSyncActive(status: AutoFilterSyncStatus) {
  return ACTIVE_AUTO_FILTER_STATUSES.has(status);
}

export function isAutoFilterSyncFailed(status: AutoFilterSyncStatus) {
  return status === "failed";
}

export function shouldSuppressAutoFilterResyncHint(status: AutoFilterSyncStatus) {
  return RESYNC_SUPPRESSED_AUTO_FILTER_STATUSES.has(status);
}

export function isImportantAutoFilterStatus(status: AutoFilterSyncStatus) {
  return isAutoFilterSyncActive(status) || isAutoFilterSyncFailed(status);
}
