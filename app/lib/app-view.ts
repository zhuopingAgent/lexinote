export type AppView = "dictionary" | "overview" | "history" | "collections";

const APP_VIEWS = new Set<AppView>([
  "dictionary",
  "overview",
  "history",
  "collections",
]);

export function parseAppView(value: string | null | undefined): AppView {
  return value && APP_VIEWS.has(value as AppView) ? (value as AppView) : "dictionary";
}
