import type { ConversationSession } from "@/shared/types/conversation";

export function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return Array.from(byId.values());
}

export function sortSessionsByActivity(sessions: ConversationSession[]) {
  return [...sessions].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.id.localeCompare(left.id)
  );
}

export function upsertSessionByActivity(
  sessions: ConversationSession[],
  incoming: ConversationSession
) {
  return sortSessionsByActivity(mergeById(sessions, [incoming]));
}

export function replaceSessionByActivity(
  sessions: ConversationSession[],
  incoming: ConversationSession
) {
  return sortSessionsByActivity(
    sessions.map((session) =>
      session.id === incoming.id ? incoming : session
    )
  );
}

export function updateSessionActivity(
  sessions: ConversationSession[],
  sessionId: string,
  updatedAt: string
) {
  return sortSessionsByActivity(
    sessions.map((session) =>
      session.id === sessionId ? { ...session, updatedAt } : session
    )
  );
}
