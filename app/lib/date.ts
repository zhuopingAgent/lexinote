const SHORT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MEDIUM_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatShortDateTime(
  value: string | null | undefined,
  fallback = ""
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return SHORT_DATE_TIME_FORMATTER.format(date);
}

export function formatMediumDateTimeOrOriginal(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return MEDIUM_DATE_TIME_FORMATTER.format(new Date(value));
  } catch {
    return value;
  }
}
