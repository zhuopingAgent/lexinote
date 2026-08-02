"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0
  );
}

export function useModalFocus<T extends HTMLElement>({
  initialFocusRef,
  isOpen,
  onClose,
}: {
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const container = containerRef.current;
    const initialFocus =
      initialFocusRef?.current ??
      (container ? getFocusableElements(container)[0] : null) ??
      container;
    initialFocus?.focus();

    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [initialFocusRef, isOpen]);

  const onKeyDown = useCallback((event: KeyboardEvent<T>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== "Tab") return;

    const container = containerRef.current;
    if (!container) return;
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    if (
      event.shiftKey &&
      (activeElement === firstElement || !container.contains(activeElement))
    ) {
      event.preventDefault();
      lastElement.focus();
    } else if (
      !event.shiftKey &&
      (activeElement === lastElement || !container.contains(activeElement))
    ) {
      event.preventDefault();
      firstElement.focus();
    }
  }, []);

  return { containerRef, onKeyDown };
}
