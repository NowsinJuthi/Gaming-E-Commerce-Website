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

export type AdminMultiSelectOption = {
  value: string;
  label: string;
};

type Props = {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: AdminMultiSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Inline accordion-style menu (no floating portal). */
  embedded?: boolean;
  /** Hide checkbox squares beside option labels. */
  hideCheckboxes?: boolean;
  /** Close the menu after an option is chosen (default: false). */
  closeOnSelect?: boolean;
};

function buildTriggerLabel(
  values: string[],
  options: AdminMultiSelectOption[],
  placeholder: string,
) {
  if (values.length === 0) return placeholder;
  if (values.length === 1) {
    return options.find((opt) => opt.value === values[0])?.label ?? placeholder;
  }
  return `${values.length} items selected`;
}

export function AdminMultiSelect({
  id,
  values,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  disabled = false,
  embedded = false,
  hideCheckboxes = false,
  closeOnSelect = false,
}: Props) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const triggerLabel = buildTriggerLabel(values, options, placeholder);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || embedded) return;

    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      zIndex: 1000,
    });
  }, [embedded]);

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
    if (!embedded) {
      window.addEventListener("resize", updateMenuPosition);
      window.addEventListener("scroll", updateMenuPosition, true);
    }
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      if (!embedded) {
        window.removeEventListener("resize", updateMenuPosition);
        window.removeEventListener("scroll", updateMenuPosition, true);
      }
    };
  }, [open, updateMenuPosition, embedded]);

  function toggleValue(value: string) {
    const isSelected = values.includes(value);
    if (isSelected) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
    if (closeOnSelect && !isSelected) {
      setOpen(false);
    }
  }

  const menuItems = options.map((option) => {
    const isSelected = values.includes(option.value);
    return (
      <li key={option.value} role="none">
        <button
          type="button"
          role="option"
          aria-selected={isSelected}
          className={`admin-select-3d-option admin-multi-select-3d-option${
            isSelected ? " is-selected" : ""
          }`}
          onMouseDown={(event) => {
            event.preventDefault();
            toggleValue(option.value);
          }}
        >
          {hideCheckboxes ? null : (
            <span
              className={`admin-multi-select-3d-check${
                isSelected ? " is-checked" : ""
              }`}
              aria-hidden
            />
          )}
          <span className="admin-multi-select-3d-label">{option.label}</span>
        </button>
      </li>
    );
  });

  const menu = open ? (
    <ul
      ref={menuRef}
      className={
        embedded
          ? "admin-multi-select-3d-menu-embedded"
          : "admin-select-3d-menu admin-multi-select-3d-menu"
      }
      role="listbox"
      aria-labelledby={selectId}
      aria-multiselectable="true"
      style={embedded ? undefined : menuStyle}
    >
      {menuItems}
    </ul>
  ) : null;

  return (
    <div
      ref={wrapRef}
      className={`admin-select-3d-wrap admin-multi-select-3d-wrap${
        embedded ? " is-embedded" : ""
      } ${className}`.trim()}
    >
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
            if (next && !embedded) {
              requestAnimationFrame(updateMenuPosition);
            }
            return next;
          });
        }}
        className={`admin-select-3d-trigger admin-multi-select-3d-trigger${
          open ? " is-open" : ""
        }${values.length > 0 ? " has-value" : ""}`}
      >
        <span
          className={`truncate admin-multi-select-3d-trigger-label${
            values.length === 0 ? " is-placeholder" : ""
          }`}
        >
          {triggerLabel}
        </span>
        <ChevronIcon className="admin-select-3d-chevron admin-multi-select-3d-chevron" />
      </button>

      {embedded
        ? menu
        : menu && mounted
          ? createPortal(menu, document.body)
          : null}
    </div>
  );
}
