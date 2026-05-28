"use client";

import { useEffect } from "react";

type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  handler: () => void;
  description: string;
  scope?: string;
};

type KeyboardShortcutsConfig = {
  shortcuts: Shortcut[];
  enabled?: boolean;
};

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: KeyboardShortcutsConfig) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const matchKey =
          event.key.toLowerCase() === shortcut.key.toLowerCase();

        const matchCtrl = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;
        const matchMeta = shortcut.meta
          ? event.metaKey
          : true;
        const matchAlt = shortcut.alt ? event.altKey : !event.altKey;
        const matchShift = shortcut.shift ? event.shiftKey : !event.shiftKey;

        if (matchKey && matchCtrl && matchMeta && matchAlt && matchShift) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}
