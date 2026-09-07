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

export type AdminSelectOption = {
  value: string;
  label: string;
};

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  className?: string;
  disabled?: boolean;
};

export function AdminSelect({
  id,
  value,
  onChange,
  options,
  className = "",
  disabled = false,
}: Props) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const selected = options.find((option) => option.value === value);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      zIndex: 1000,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    function onPointerDown(event: PointerEvent) {
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

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && mounted ? (
      <ul
        ref={menuRef}
        className="admin-select-3d-menu"
        role="listbox"
        aria-labelledby={selectId}
        style={menuStyle}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <li key={option.value || "__empty"} role="none">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`admin-select-3d-option${isSelected ? " is-selected" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={wrapRef} className={`admin-select-3d-wrap ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        disabled={disabled}
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
        className="admin-select-3d-trigger"
      >
        <span className="truncate">{selected?.label ?? options[0]?.label ?? ""}</span>
        <ChevronIcon className="admin-select-3d-chevron" />
      </button>

      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
