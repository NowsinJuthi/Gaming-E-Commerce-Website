"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/components/admin/icons";
import type { BlogCategory } from "@/lib/api";

type Props = {
  id?: string;
  value: string;
  onChange: (categoryId: string) => void;
  categories: BlogCategory[];
  disabled?: boolean;
};

export function BlogCategorySearchSelect({
  id = "blog-category",
  value,
  onChange,
  categories,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const activeCategories = useMemo(
    () => categories.filter((cat) => cat.isActive !== false),
    [categories],
  );

  const selected = useMemo(
    () => activeCategories.find((cat) => cat.id === value) ?? null,
    [activeCategories, value],
  );

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeCategories;
    return activeCategories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.slug.toLowerCase().includes(q) ||
        (cat.description ?? "").toLowerCase().includes(q),
    );
  }, [activeCategories, query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  function selectCategory(categoryId: string) {
    onChange(categoryId);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="space-y-2">
      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/25 bg-brand/10 px-3 py-2">
          <p className="min-w-0 text-sm text-foreground">
            <span className="text-subtle">Selected: </span>
            <span className="font-medium">{selected.name}</span>
            <span className="ml-2 text-xs text-subtle">/{selected.slug}</span>
          </p>
          <button
            type="button"
            className="btn-secondary btn-secondary-sm shrink-0"
            disabled={disabled}
            onClick={() => onChange("")}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="admin-input-icon-wrap">
        <SearchIcon className="admin-input-icon" aria-hidden />
        <input
          id={id}
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type name or slug (e.g. pubg, gaming guide)…"
          className="admin-input blog-category-search-input w-full"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
        />
      </div>

      {open && !disabled ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label="Blog categories"
          className="max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-border/50 bg-elevated shadow-lg"
        >
          {filteredCategories.length === 0 ? (
            <p className="px-3 py-4 text-sm text-subtle">
              {query.trim()
                ? `No categories match "${query.trim()}".`
                : "No active categories found."}
            </p>
          ) : (
            <ul className="divide-y divide-border/40 py-1">
              {filteredCategories.map((cat) => {
                const isSelected = cat.id === value;
                return (
                  <li key={cat.id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-brand/10 text-foreground"
                          : "text-foreground-muted hover:bg-muted/40"
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCategory(cat.id)}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {cat.name}
                      </span>
                      <span className="text-xs text-subtle">/{cat.slug}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
