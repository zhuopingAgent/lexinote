export type TopNavigationSection = "dictionary" | "grammar" | "conversation";

const ITEMS = [
  { key: "dictionary" as const, label: "辞書", href: "/" },
  { key: "grammar" as const, label: "文法", href: "/grammar" },
  { key: "conversation" as const, label: "対話", href: "/conversation" },
];

export function getTopNavigationItems(activeSection: TopNavigationSection) {
  return ITEMS.map((item) => ({
    label: item.label,
    href: item.href,
    active: item.key === activeSection,
  }));
}
