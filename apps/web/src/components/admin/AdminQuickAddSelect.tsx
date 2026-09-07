"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronIcon } from "@/components/admin/icons";

export type AdminQuickAddGroup = {
  label: string;
  items: { value: string; label: string }[];
};

type Props = {
  id?: string;
  placeholder: string;
  groups: AdminQuickAddGroup[];
  onPick: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function AdminQuickAddSelect({
  id,
  placeholder,
  groups,
  onPick,
  className = "",
  disabled = false,
}: Props) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const hasItems = groups.some((group) => group.items.length > 0);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 220),
      zIndex: 120,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        wrapRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && mounted && hasItems ? (
      <div
        ref={menuRef}
        className="admin-select-3d-menu admin-quick-add-menu"
        role="listbox"
        aria-labelledby={selectId}
        style={menuStyle}
      >
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.label} className="admin-quick-add-group">
              <p className="admin-quick-add-group-label">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  className="admin-select-3d-option"
                  onClick={() => {
                    onPick(item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ),
        )}
      </div>
    ) : null;

  return (
    <div
      ref={wrapRef}
      className={`admin-select-3d-wrap ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        disabled={disabled || !hasItems}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) {
              requestAnimationFrame(updateMenuPosition);
            }
            return next;
          });
        }}
        className="admin-select-3d-trigger admin-quick-add-trigger"
      >
        <span className="truncate text-foreground-muted">{placeholder}</span>
        <ChevronIcon className="admin-select-3d-chevron" />
      </button>

      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
