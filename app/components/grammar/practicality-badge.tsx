import type { Practicality, SpokenOrWritten } from "@/shared/types/grammar";

const PRACTICALITY_LABELS: Record<Practicality, string> = {
  S: "高频实用",
  A: "常用",
  B: "场景型",
  C: "低频",
  D: "谨慎使用",
};

const SPOKEN_WRITTEN_LABELS: Record<SpokenOrWritten, string> = {
  spoken: "口语",
  written: "书面",
  both: "口语 / 书面",
};

export function PracticalityBadge({
  practicality,
}: {
  practicality: Practicality;
}) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
      {PRACTICALITY_LABELS[practicality]} {practicality}
    </span>
  );
}

export function SpokenOrWrittenBadge({
  value,
}: {
  value: SpokenOrWritten;
}) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-white/55">
      {SPOKEN_WRITTEN_LABELS[value]}
    </span>
  );
}
