"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { X } from "lucide-react";

export interface SearchableSelectItem {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  ariaLabel: string;
  clearLabel?: string;
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function SearchableSelect({
  items,
  value,
  onChange,
  placeholder = "Cerca...",
  emptyMessage = "Nessun risultato",
  ariaLabel,
  clearLabel = "Cancella selezione",
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // When this component is nested inside a Radix Dialog, the Dialog's modal
  // scroll lock (react-remove-scroll) blocks trackpad/wheel scrolling here:
  // it intercepts wheel events bubbling up through the *React* tree (which
  // still runs through the Dialog even though Popover.Content is portaled to
  // document.body) and calls preventDefault before the browser can scroll.
  // Scroll the list manually so it keeps working regardless of that lock
  // (touch scrolling on mobile isn't intercepted the same way, which is why
  // only desktop trackpad/wheel scrolling is affected).
  function handleWheel(e: WheelEvent) {
    const el = e.currentTarget as HTMLDivElement;
    el.scrollTop += e.deltaY;
    e.preventDefault();
  }

  const attachListRef = useCallback((node: HTMLDivElement | null) => {
    listRef.current?.removeEventListener("wheel", handleWheel);
    listRef.current = node;
    node?.addEventListener("wheel", handleWheel, { passive: false });
  }, []);

  const selectedItem = items.find((i) => i.id === value);

  const filteredItems = useMemo(() => {
    const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items;
    return items.filter((item) => {
      const label = normalize(item.label);
      return tokens.every((t) => label.includes(t));
    });
  }, [items, query]);

  function handleSelect(item: SearchableSelectItem) {
    onChange(item.id);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (selectedItem) {
    return (
      <div className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
        <span className="truncate">{selectedItem.label}</span>
        <button
          type="button"
          onClick={handleClear}
          aria-label={clearLabel}
          className="p-0.5 rounded hover:bg-secondary text-muted-foreground shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          ref={attachListRef}
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-[60] w-[var(--radix-popover-trigger-width)] max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-1"
        >
          {filteredItems.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3 py-2.5 rounded-md text-sm hover:bg-secondary focus:bg-secondary focus:outline-none"
              >
                {item.label}
              </button>
            ))
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
