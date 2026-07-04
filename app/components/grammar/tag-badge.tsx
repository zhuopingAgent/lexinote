import type { GrammarTag } from "@/shared/types/api";

type TagBadgeProps = {
  tag: GrammarTag | string;
  tone?: "scene" | "register" | "neutral";
};

export function TagBadge({ tag, tone = "neutral" }: TagBadgeProps) {
  const label = typeof tag === "string" ? tag : tag.nameZh;
  const title = typeof tag === "string" ? undefined : tag.description;
  const className =
    tone === "scene"
      ? "inline-flex min-h-7 items-center rounded-full border border-[#73d7ff33] bg-[#73d7ff14] px-3 py-1 text-xs font-medium text-[#9adfff]"
      : tone === "register"
        ? "inline-flex min-h-7 items-center rounded-full border border-[#ffbe5c33] bg-[#ffbe5c14] px-3 py-1 text-xs font-medium text-[#ffd08a]"
        : "inline-flex min-h-7 items-center rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-white/55";

  return (
    <span className={className} title={title}>
      {label}
    </span>
  );
}
