"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";

function plainTextLength(html: string): number {
  if (!html) return 0;
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").length;
}

function truncateHtml(html: string, maxLength: number): string {
  if (!html || plainTextLength(html) <= maxLength) return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  let len = 0;

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const remaining = maxLength - len;
      if (text.length > remaining) {
        node.textContent = text.slice(0, remaining);
        len = maxLength;
        return true;
      }
      len += text.length;
      return len >= maxLength;
    }

    const children = [...node.childNodes];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child && walk(child)) {
        for (let j = i + 1; j < children.length; j++) {
          children[j]?.remove();
        }
        return true;
      }
    }
    return len >= maxLength;
  }

  walk(div);
  return div.innerHTML;
}

/** Default editor height — one line of text; drag to see the rest. */
export const RICH_EDITOR_SINGLE_LINE_PREVIEW_HEIGHT = "3rem";

const BLOCK_FORMAT_OPTIONS = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "pre", label: "Preformatted" },
] as const;

const INSERT_MENU_OPTIONS = [
  { value: "link", label: "Link" },
  { value: "image", label: "Image" },
  { value: "hr", label: "Horizontal line" },
] as const;

function normalizeBlockFormat(raw: string): string {
  const tag = raw.replace(/[<>]/g, "").toLowerCase();
  if (tag === "div" || !tag) return "p";
  if (BLOCK_FORMAT_OPTIONS.some((opt) => opt.value === tag)) return tag;
  return "p";
}

function expandedHeight(minHeight: string): string {
  const match = minHeight.match(/^(\d+(?:\.\d+)?)(px|rem|em)$/);
  if (!match) return "320px";
  const numericValue = match[1];
  const unit = match[2];
  if (!numericValue || !unit) return "320px";
  const num = parseFloat(numericValue);
  return `${Math.round(num * 2.5)}${unit}`;
}

const iconCls = "rich-editor-toolbar-icon";

function ToolbarIcon({
  children,
  className = iconCls,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconBold() {
  return (
    <ToolbarIcon>
      <path d="M6 4h7.2a3.4 3.4 0 0 1 0 6.8H6V4Z" />
      <path d="M6 10.8h8.1a3.6 3.6 0 0 1 0 7.2H6v-7.2Z" />
    </ToolbarIcon>
  );
}

function IconItalic() {
  return (
    <ToolbarIcon>
      <path d="M11 5h8" />
      <path d="M5 19h8" />
      <path d="M14 5 10 19" />
    </ToolbarIcon>
  );
}

function IconAlignLeft() {
  return (
    <ToolbarIcon>
      <path d="M4 6h16M4 10h10M4 14h14M4 18h8" />
    </ToolbarIcon>
  );
}

function IconAlignCenter() {
  return (
    <ToolbarIcon>
      <path d="M4 6h16M7 10h10M5 14h14M8 18h8" />
    </ToolbarIcon>
  );
}

function IconAlignRight() {
  return (
    <ToolbarIcon>
      <path d="M4 6h16M10 10h10M6 14h14M12 18h8" />
    </ToolbarIcon>
  );
}

function IconBulletList() {
  return (
    <ToolbarIcon>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="5" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </ToolbarIcon>
  );
}

function IconNumberList() {
  return (
    <ToolbarIcon>
      <path d="M10 6h11M10 12h11M10 18h11" />
      <path d="M5.5 7.5V5.2c0-.8.6-1.4 1.4-1.4.6 0 1.1.4 1.2.9" />
      <path d="M5 18h2.2M5 15.2h2.4c.8 0 1.4.6 1.4 1.4v.1c0 .8-.6 1.4-1.4 1.4H5" />
    </ToolbarIcon>
  );
}

function IconQuote() {
  return (
    <ToolbarIcon>
      <path d="M7.5 9.5c0-2.2 1.8-4 4-4v2.2a1.8 1.8 0 0 0-1.8 1.8v1.5H7.5V9.5Z" />
      <path d="M14.5 9.5c0-2.2 1.8-4 4-4v2.2a1.8 1.8 0 0 0-1.8 1.8v1.5h-2.2V9.5Z" />
    </ToolbarIcon>
  );
}

function IconLink() {
  return (
    <ToolbarIcon>
      <path d="M10 14a4.2 4.2 0 0 0 5.9 0l2.1-2.1a4.2 4.2 0 0 0-5.9-5.9l-1.1 1.1" />
      <path d="M14 10a4.2 4.2 0 0 0-5.9 0L6 12.1a4.2 4.2 0 0 0 5.9 5.9l1.1-1.1" />
    </ToolbarIcon>
  );
}

function IconImage() {
  return (
    <ToolbarIcon>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m4 16 4.5-4.5 3.5 3.5L16 11l4 4" />
    </ToolbarIcon>
  );
}

function IconUndo() {
  return (
    <ToolbarIcon>
      <path d="M8 7H5.5V4.5" />
      <path d="M6.2 7A8 8 0 1 1 6 16" />
    </ToolbarIcon>
  );
}

function IconExpand({ expanded }: { expanded: boolean }) {
  return expanded ? (
    <ToolbarIcon>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </ToolbarIcon>
  ) : (
    <ToolbarIcon>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </ToolbarIcon>
  );
}

function ToolbarDivider() {
  return <span className="rich-editor-toolbar-divider" aria-hidden />;
}

function ToolbarBtn({
  title,
  onClick,
  onMouseDown,
  pressed,
  disabled,
  children,
  className = "",
}: {
  title: string;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  pressed?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`rich-editor-toolbar-btn${pressed ? " rich-editor-toolbar-btn--active" : ""}${className ? ` ${className}` : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxLength?: number;
  minHeight?: string;
  /** Allow vertical resize via drag handle (WordPress-style). */
  resizable?: boolean;
  /** No character cap; editor grows with content and can be resized without max height. */
  unlimitedHeight?: boolean;
  /** When set, image insert uses file upload instead of a URL prompt. */
  onImageUpload?: (file: File) => Promise<string>;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  maxLength,
  minHeight = "120px",
  resizable = true,
  unlimitedHeight = false,
  onImageUpload,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [textColor, setTextColor] = useState("#22d3ee");
  const [blockFormat, setBlockFormat] = useState("p");
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const activeMinHeight = expanded ? expandedHeight(minHeight) : minHeight;

  const syncFromValue = useCallback(() => {
    const el = editorRef.current;
    if (!el || el.innerHTML === value) return;
    el.innerHTML = value || "";
    setCharCount(plainTextLength(value));
  }, [value]);

  useEffect(() => {
    syncFromValue();
  }, [syncFromValue]);

  function emitChange() {
    const el = editorRef.current;
    if (!el) return;
    let html = el.innerHTML;
    if (maxLength) {
      const len = plainTextLength(html);
      if (len > maxLength) {
        html = truncateHtml(html, maxLength);
        el.innerHTML = html;
      }
      setCharCount(plainTextLength(html));
    }
    onChange(html === "<br>" ? "" : html);
  }

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    emitChange();
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }

  function insertImage() {
    if (onImageUpload) {
      imageInputRef.current?.click();
      return;
    }
    const url = window.prompt("Image URL");
    if (url) exec("insertImage", url);
  }

  async function handleImageFile(file: File) {
    if (!onImageUpload) return;
    if (!file.type.startsWith("image/")) return;
    setImageUploadBusy(true);
    try {
      const url = await onImageUpload(file);
      if (url) exec("insertImage", url);
    } finally {
      setImageUploadBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function applyTextColor(color: string) {
    setTextColor(color);
    exec("foreColor", color);
  }

  function syncBlockFormat() {
    const tag = normalizeBlockFormat(document.queryCommandValue("formatBlock"));
    setBlockFormat(tag);
  }

  function applyBlockFormat(value: string) {
    exec("formatBlock", value);
    setBlockFormat(value);
  }

  function handleInsertMenu(value: string) {
    if (value === "link") insertLink();
    else if (value === "image") insertImage();
    else if (value === "hr") exec("insertHorizontalRule");
  }

  return (
    <div className="admin-product-form-editor rounded-xl border border-border bg-sunken">
      {onImageUpload ? (
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageFile(file);
          }}
        />
      ) : null}
      <div className="rich-editor-toolbar">
        <div className="rich-editor-format-select-wrap">
          <select
            className="rich-editor-format-select"
            value={blockFormat}
            onChange={(e) => applyBlockFormat(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Text format"
          >
            {BLOCK_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rich-editor-format-select-wrap">
          <select
            className="rich-editor-insert-select"
            defaultValue=""
            onChange={(e) => {
              const value = e.target.value;
              if (value) handleInsertMenu(value);
              e.currentTarget.value = "";
            }}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Insert"
          >
            <option value="" disabled>
              Insert
            </option>
            {INSERT_MENU_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <ToolbarDivider />

        <ToolbarBtn title="Bold" onClick={() => exec("bold")}>
          <IconBold />
        </ToolbarBtn>
        <ToolbarBtn title="Italic" onClick={() => exec("italic")}>
          <IconItalic />
        </ToolbarBtn>
        <div className="rich-editor-color-control relative">
          <ToolbarBtn
            title="Text color"
            className="rich-editor-color-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => colorInputRef.current?.click()}
          >
            <span
              className="rich-editor-color-letter font-bold leading-none"
              style={{ color: textColor }}
            >
              A
            </span>
            <span
              className="rich-editor-color-bar"
              style={{ backgroundColor: textColor }}
            />
          </ToolbarBtn>
          <input
            ref={colorInputRef}
            type="color"
            value={textColor}
            onChange={(e) => applyTextColor(e.target.value)}
            className="rich-editor-color-input"
            tabIndex={-1}
            aria-hidden
          />
        </div>

        <ToolbarDivider />

        <ToolbarBtn title="Align left" onClick={() => exec("justifyLeft")}>
          <IconAlignLeft />
        </ToolbarBtn>
        <ToolbarBtn title="Align center" onClick={() => exec("justifyCenter")}>
          <IconAlignCenter />
        </ToolbarBtn>
        <ToolbarBtn title="Align right" onClick={() => exec("justifyRight")}>
          <IconAlignRight />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn
          title="Bullet list"
          onClick={() => exec("insertUnorderedList")}
        >
          <IconBulletList />
        </ToolbarBtn>
        <ToolbarBtn
          title="Numbered list"
          onClick={() => exec("insertOrderedList")}
        >
          <IconNumberList />
        </ToolbarBtn>
        <ToolbarBtn
          title="Blockquote"
          onClick={() => exec("formatBlock", "blockquote")}
        >
          <IconQuote />
        </ToolbarBtn>
        <ToolbarBtn title="Insert link" onClick={insertLink}>
          <IconLink />
        </ToolbarBtn>
        <ToolbarBtn
          title="Insert image"
          onClick={insertImage}
          disabled={imageUploadBusy}
        >
          <IconImage />
        </ToolbarBtn>
        <ToolbarBtn title="Undo" onClick={() => exec("undo")}>
          <IconUndo />
        </ToolbarBtn>

        {resizable ? (
          <>
            <ToolbarDivider />
            <ToolbarBtn
              title={expanded ? "Collapse editor" : "Expand editor"}
              pressed={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <IconExpand expanded={expanded} />
            </ToolbarBtn>
          </>
        ) : null}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onKeyUp={syncBlockFormat}
        onMouseUp={syncBlockFormat}
        className={`rich-editor-body px-4 py-3 text-sm leading-relaxed text-foreground outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&:empty]:before:pointer-events-none [&:empty]:before:text-subtle [&:empty]:before:content-[attr(data-placeholder)] [&_img]:my-2 [&_img]:max-h-48 [&_img]:rounded-lg [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted/40 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs${resizable ? " rich-editor-body--resizable" : ""}${unlimitedHeight ? " rich-editor-body--unlimited" : ""}`}
        style={{ minHeight: activeMinHeight }}
      />

      {maxLength != null && (
        <div className="border-t border-border px-4 py-2 text-xs text-subtle">
          {charCount}/{maxLength} characters
        </div>
      )}

      {resizable ? (
        <div
          className="rich-editor-resize-hint border-t border-border px-4 py-1.5 text-[10px] text-subtle"
          aria-hidden
        >
          {unlimitedHeight
            ? "Unlimited length. Drag the corner or use expand while writing."
            : "One line shows at first. Drag the corner or use expand to see the rest."}
        </div>
      ) : null}
    </div>
  );
}

type RichTextSectionProps = RichTextEditorProps & {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  fieldLabel?: string;
  badge?: string;
  /** Right-side icon toggles the editor open/closed. Starts closed when enabled. */
  collapsible?: boolean;
};

export function RichTextSection({
  icon,
  title,
  subtitle,
  fieldLabel = "Content",
  badge,
  collapsible = false,
  ...editorProps
}: RichTextSectionProps) {
  const [open, setOpen] = useState(false);

  const showEditor = !collapsible || open;

  const toggleAction =
    collapsible || badge ? (
      <div className="flex shrink-0 items-center gap-2">
        {collapsible ? (
          <button
            type="button"
            className="rich-text-section-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close editor" : "Open editor"}
            aria-expanded={open}
          >
            <ChevronIcon
              className={`rich-text-section-toggle-icon${open ? " rich-text-section-toggle-icon--open" : ""}`}
            />
          </button>
        ) : null}
        {badge ? (
          <span className="inline-flex shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            {badge}
          </span>
        ) : null}
      </div>
    ) : undefined;

  return (
    <ProductFormOrderCard
      className="admin-product-form-section"
      icon={icon}
      title={title}
      subtitle={subtitle}
      action={toggleAction}
      showBody={showEditor}
    >
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>{fieldLabel}</dt>
        <dd className="admin-product-form-rich-fields">
          <RichTextEditor {...editorProps} />
        </dd>
      </div>
    </ProductFormOrderCard>
  );
}
