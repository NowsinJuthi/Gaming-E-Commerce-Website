"use client";

import { useId, useState } from "react";
import { ChevronIcon, KeyIcon, TrashIcon } from "@/components/admin/icons";

const inputCls = "admin-input w-full text-foreground placeholder:text-subtle";
const labelCls = "admin-filter-label";

export function normalizeRegionCode(value: string): string {
  return value.trim().toUpperCase();
}

export function parseRegionInput(raw: string): string[] {
  const seen = new Set<string>();
  const regions: string[] = [];
  // Split only on comma or semicolon so multi-word names like
  // "United States-US" are kept as a single region code.
  for (const part of raw.split(/[,;]+/)) {
    const code = normalizeRegionCode(part);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    regions.push(code);
  }
  return regions;
}

export type CustomOrderField = {
  id: string;
  label: string;
  enabled: boolean;
  messages: string[];
  regions: string[];
};

function newId() {
  return `cof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyCustomOrderField(): CustomOrderField {
  return {
    id: newId(),
    label: "",
    enabled: true,
    messages: [""],
    regions: [],
  };
}

export function parseCustomOrderFields(
  raw?: Array<{
    label?: string;
    enabled?: boolean;
    messages?: string[];
    regions?: string[];
    placeholder?: string;
    required?: boolean;
    supplierKey?: string;
  }>,
): CustomOrderField[] {
  if (!raw?.length) return [];
  return raw.map((item, i) => ({
    id: `stored-cof-${i}`,
    label: String(item.label ?? ""),
    enabled: item.enabled !== false,
    messages:
      Array.isArray(item.messages) && item.messages.length > 0
        ? item.messages.map((m) => String(m))
        : [""],
    regions: Array.isArray(item.regions)
      ? [
          ...new Set(
            item.regions
              .map((region) => normalizeRegionCode(String(region)))
              .filter(Boolean),
          ),
        ]
      : [],
  }));
}

export function mergeCustomOrderFieldRegionDrafts(
  fields: CustomOrderField[],
  drafts: Record<string, string>,
): CustomOrderField[] {
  return fields.map((field) => {
    const draft = drafts[field.id]?.trim();
    if (!draft) return field;
    const pending = parseRegionInput(draft).filter(
      (code) => !field.regions.includes(code),
    );
    if (!pending.length) return field;
    return { ...field, regions: [...field.regions, ...pending] };
  });
}

export function serializeCustomOrderFields(fields: CustomOrderField[]) {
  return fields
    .map((f) => ({
      label: f.label.trim(),
      enabled: f.enabled,
      messages: f.messages.map((m) => m.trim()).filter(Boolean),
      regions: f.regions.map(normalizeRegionCode).filter(Boolean),
    }))
    .filter((f) => f.label.length > 0);
}

export function flattenDeliveryMessageOptions(
  fields: CustomOrderField[],
): Array<{ id: string; templateLabel: string; message: string }> {
  const options: Array<{ id: string; templateLabel: string; message: string }> =
    [];
  for (const field of fields) {
    if (!field.enabled || !field.label.trim()) continue;
    field.messages.forEach((message, index) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      options.push({
        id: `${field.id}-${index}`,
        templateLabel: field.label.trim(),
        message: trimmed,
      });
    });
  }
  return options;
}

type CustomOrderFieldsEditorProps = {
  fields: CustomOrderField[];
  onChange: (fields: CustomOrderField[]) => void;
  saving?: boolean;
  onSave: (fields: CustomOrderField[]) => void | Promise<void>;
};

function TemplateActionIcons({
  onAddField,
  onDelete,
}: {
  onAddField: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="admin-template-action-icons">
      <button
        type="button"
        onClick={onAddField}
        className="admin-template-icon-btn"
        aria-label="Add Field"
      >
        <span aria-hidden>+</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="admin-template-icon-btn admin-template-icon-btn--danger"
        aria-label="Delete template"
      >
        <TrashIcon className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function TemplateCard({
  field,
  index,
  onUpdate,
  onRemove,
  onUpdateMessage,
  onAddMessage,
  onRemoveMessage,
  onAddRegion,
  onRemoveRegion,
  regionDraft,
  onRegionDraftChange,
}: {
  field: CustomOrderField;
  index: number;
  onUpdate: (patch: Partial<CustomOrderField>) => void;
  onRemove: () => void;
  onUpdateMessage: (msgIndex: number, value: string) => void;
  onAddMessage: () => void;
  onRemoveMessage: (msgIndex: number) => void;
  onAddRegion: (code: string) => void;
  onRemoveRegion: (code: string) => void;
  regionDraft: string;
  onRegionDraftChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const templateTitle =
    field.label.trim() || `Template ${index + 1}`;
  const regionSummary =
    field.regions.length > 0 ? field.regions.join(", ") : "All regions";

  function submitRegionDraft() {
    const codes = parseRegionInput(regionDraft);
    if (!codes.length) return;
    for (const code of codes) {
      onAddRegion(code);
    }
    onRegionDraftChange("");
  }

  return (
    <div className="admin-template-card">
      <button
        type="button"
        className="admin-template-collapse-trigger admin-template-collapse-trigger--top"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span
          className={`truncate admin-template-collapse-title${field.label.trim() ? " admin-template-collapse-title--named" : ""}`}
        >
          {templateTitle}
          <span className="ml-2 text-[10px] font-normal text-subtle">
            · {regionSummary}
          </span>
        </span>
        <span className="admin-template-collapse-chevron-wrap" aria-hidden>
          <ChevronIcon
            className={`admin-template-collapse-chevron${expanded ? " admin-template-collapse-chevron--open" : ""}`}
          />
        </span>
      </button>

      {expanded ? (
        <div id={panelId} className="admin-template-collapse-panel">
          <div className="admin-template-card-top">
            <div className="min-w-0 flex-1">
              <label className={labelCls} htmlFor={`cof-label-${field.id}`}>
                Template name
              </label>
              <input
                id={`cof-label-${field.id}`}
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="e.g. PUBG UC delivery"
                className={inputCls}
              />
            </div>
            <TemplateActionIcons
              onAddField={onAddMessage}
              onDelete={onRemove}
            />
          </div>

          <div className="mb-4">
            <label className={labelCls} htmlFor={`cof-regions-${field.id}`}>
              Regions
            </label>
            <p className="mb-2 text-[11px] text-subtle">
              Leave empty for all regions. Type one region per line or separate
              with commas — e.g. <strong>BD</strong>, <strong>United States-US</strong>,{" "}
              <strong>GLOBAL</strong>. Spaces inside a name are allowed.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                id={`cof-regions-${field.id}`}
                value={regionDraft}
                onChange={(e) => onRegionDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitRegionDraft();
                  }
                }}
                onBlur={submitRegionDraft}
                placeholder="e.g. BD, United States-US, GLOBAL"
                className={`${inputCls} min-w-[10rem] flex-1`}
              />
              <button
                type="button"
                onClick={submitRegionDraft}
                className="dashboard-pro-btn-ghost shrink-0 px-3 py-2 text-xs"
              >
                + Add region
              </button>
            </div>
            {field.regions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {field.regions.map((region) => (
                  <span
                    key={`${field.id}-${region}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground"
                  >
                    {region}
                    <button
                      type="button"
                      onClick={() => onRemoveRegion(region)}
                      className="rounded-full p-0.5 text-subtle transition hover:text-rose-400"
                      aria-label={`Remove region ${region}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-subtle">Applies to every region.</p>
            )}
          </div>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
            Pre-written messages
          </p>
          <div className="space-y-3">
            {field.messages.map((message, msgIndex) => (
              <div key={`${field.id}-msg-${msgIndex}`} className="admin-template-message-box">
                <div className="admin-template-message-box-main">
                  <span className="text-[10px] text-subtle">
                    Message {msgIndex + 1}
                  </span>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => onUpdateMessage(msgIndex, e.target.value)}
                    placeholder="e.g. Your 60 UC has been added. Player ID: {playerId}. Enjoy!"
                    aria-label={`Message ${msgIndex + 1} for ${field.label.trim() || "this template"}`}
                    className={`${inputCls} min-h-[5rem] resize-y text-sm`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveMessage(msgIndex)}
                  className="admin-template-icon-btn admin-template-icon-btn--danger admin-template-icon-btn--sm shrink-0"
                  aria-label={`Remove message ${msgIndex + 1}`}
                >
                  <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CustomOrderFieldsEditor({  fields,
  onChange,
  saving = false,
  onSave,
}: CustomOrderFieldsEditorProps) {
  const [regionDrafts, setRegionDrafts] = useState<Record<string, string>>({});
  function update(id: string, patch: Partial<CustomOrderField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function remove(id: string) {
    const field = fields.find((f) => f.id === id);
    const name = field?.label.trim() || "this template";
    if (!window.confirm(`Delete "${name}"? Click Save templates to keep this change.`)) {
      return;
    }
    onChange(fields.filter((f) => f.id !== id));
  }

  function addField() {
    onChange([...fields, emptyCustomOrderField()]);
  }

  function updateMessage(fieldId: string, index: number, value: string) {
    onChange(
      fields.map((f) => {
        if (f.id !== fieldId) return f;
        const messages = [...f.messages];
        messages[index] = value;
        return { ...f, messages };
      }),
    );
  }

  function addMessage(fieldId: string) {
    onChange(
      fields.map((f) =>
        f.id === fieldId ? { ...f, messages: [...f.messages, ""] } : f,
      ),
    );
  }

  function removeMessage(fieldId: string, index: number) {
    onChange(
      fields.map((f) => {
        if (f.id !== fieldId) return f;
        const messages = f.messages.filter((_, i) => i !== index);
        return { ...f, messages: messages.length ? messages : [""] };
      }),
    );
  }

  function addRegion(fieldId: string, code: string) {
    const normalized = normalizeRegionCode(code);
    if (!normalized) return;
    onChange(
      fields.map((f) => {
        if (f.id !== fieldId) return f;
        if (f.regions.includes(normalized)) return f;
        return { ...f, regions: [...f.regions, normalized] };
      }),
    );
  }

  function removeRegion(fieldId: string, code: string) {
    onChange(
      fields.map((f) =>
        f.id === fieldId
          ? { ...f, regions: f.regions.filter((region) => region !== code) }
          : f,
      ),
    );
  }

  async function handleSave() {
    const merged = mergeCustomOrderFieldRegionDrafts(fields, regionDrafts);
    onChange(merged);
    setRegionDrafts({});
    await onSave(merged);
  }

  return (
    <div className="space-y-4">
      <div className="admin-delivery-manual-head">
        <span className="admin-delivery-section-icon shrink-0" aria-hidden>
          <KeyIcon className="h-4 w-4" />
        </span>
        <h2 className="shrink-0 text-sm font-semibold text-foreground">
          Manual Delivery
        </h2>
        <p className="admin-delivery-manual-head-desc min-w-0 text-xs text-subtle">
          Write delivery message templates in advance. Saved templates appear in
          Sales → Orders → Manual Gift Card Delivery → Delivery field when you
          fulfill an order.
        </p>
        <p className="shrink-0 text-xs text-subtle">
          Changes apply after you click{" "}
          <strong className="text-foreground-muted">Save templates</strong>.
        </p>
        <div className="admin-delivery-manual-head-actions shrink-0">
          <button type="button" onClick={addField} className="panel-3d-btn panel-3d-btn-sm">
            + Add template
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="panel-3d-btn-ghost panel-3d-btn-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save templates"}
          </button>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-subtle">
          No delivery message templates yet. Add a template group and write
          preset messages — you will pick one when marking an order complete.
        </p>
      ) : (
        <div className="admin-template-list">
          {fields.map((field, index) => (
            <TemplateCard
              key={field.id}
              field={field}
              index={index}
              onUpdate={(patch) => update(field.id, patch)}
              onRemove={() => remove(field.id)}
              onUpdateMessage={(msgIndex, value) =>
                updateMessage(field.id, msgIndex, value)
              }
              onAddMessage={() => addMessage(field.id)}
              onRemoveMessage={(msgIndex) => removeMessage(field.id, msgIndex)}
              onAddRegion={(code) => addRegion(field.id, code)}
              onRemoveRegion={(code) => removeRegion(field.id, code)}
              regionDraft={regionDrafts[field.id] ?? ""}
              onRegionDraftChange={(value) =>
                setRegionDrafts((current) => ({ ...current, [field.id]: value }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
