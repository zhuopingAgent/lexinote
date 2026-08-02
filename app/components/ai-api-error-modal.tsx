"use client";

import { useEffect, useRef } from "react";
import { AI_QUOTA_EXHAUSTED_MESSAGE } from "@/shared/utils/errors";

type AiApiErrorModalProps = {
  message?: string | null;
  onClose: () => void;
};

export function AiApiErrorModal({ message, onClose }: AiApiErrorModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isOpen = Boolean(message);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!message) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-api-error-title"
        aria-describedby="ai-api-error-description"
        className="w-full max-w-[420px] rounded-lg border border-danger/30 bg-[#1e1e1ef2] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
      >
        <h2
          id="ai-api-error-title"
          className="text-lg font-semibold leading-7 text-white/82"
        >
          AI API 额度不足
        </h2>
        <p id="ai-api-error-description" className="mt-3 text-sm leading-6 text-white/58">
          {message || AI_QUOTA_EXHAUSTED_MESSAGE}
        </p>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong"
        >
          我知道了
        </button>
      </section>
    </div>
  );
}
