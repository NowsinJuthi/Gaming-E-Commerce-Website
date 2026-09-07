"use client";

import { useId, useState } from "react";
import { ChevronIcon, MailIcon, TrashIcon } from "@/components/admin/icons";

const inputCls = "admin-input w-full text-foreground placeholder:text-subtle";
const labelCls = "admin-filter-label";

export type SavedDeliveryNote = {
  id: string;
  label: string;
  enabled: boolean;
  note: string;
};

function newId() {
  return `sdn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptySavedDeliveryNote(): SavedDeliveryNote {
  return {
    id: newId(),
    label: "",
    enabled: true,
    note: "",
  };
}

export function parseSavedDeliveryNotes(
  raw?: Array<{
    label?: string;
    enabled?: boolean;
    note?: string;
  }>,
): SavedDeliveryNote[] {
  if (!raw?.length) return [];
  return raw.map((item, i) => ({
    id: `stored-sdn-${i}`,
    label: String(item.label ?? ""),
    enabled: item.enabled !== false,
    note: String(item.note ?? ""),
  }));
}

export function serializeSavedDeliveryNotes(notes: SavedDeliveryNote[]) {
  return notes
    .map((item) => ({
      label: item.label.trim(),
      enabled: item.enabled,
      note: item.note.trim(),
    }))
    .filter((item) => item.label.length > 0 && item.note.length > 0);
}

export function listSavedDeliveryNoteOptions(notes: SavedDeliveryNote[]) {
  return notes
    .filter((item) => item.enabled && item.label.trim() && item.note.trim())
    .map((item) => ({
      id: item.id,
      label: item.label.trim(),
      note: item.note.trim(),
    }));
}

type SavedDeliveryNotesEditorProps = {
  notes: SavedDeliveryNote[];
  onChange: (notes: SavedDeliveryNote[]) => void;
  saving?: boolean;
  onSave: () => void;
};

function NoteCard({
  note,
  index,
  onUpdate,
  onRemove,
}: {
  note: SavedDeliveryNote;
  index: number;
  onUpdate: (patch: Partial<SavedDeliveryNote>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const noteTitle = note.label.trim() || `Note ${index + 1}`;

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
          className={`truncate admin-template-collapse-title${note.label.trim() ? " admin-template-collapse-title--named" : ""}`}
        >
          {noteTitle}
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
              <label className={labelCls} htmlFor={`sdn-label-${note.id}`}>
                Note title
              </label>
              <input
                id={`sdn-label-${note.id}`}
                value={note.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="e.g. Gift card delivered"
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="admin-template-icon-btn admin-template-icon-btn--danger"
              aria-label="Delete note"
            >
              <TrashIcon className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <label className={labelCls} htmlFor={`sdn-note-${note.id}`}>
            Note text
          </label>
          <textarea
            id={`sdn-note-${note.id}`}
            rows={6}
            value={note.note}
            onChange={(e) => onUpdate({ note: e.target.value })}
            placeholder="e.g. Your gift card has been sent. Code: XXXX-XXXX. Thank you for your order!"
            className={`${inputCls} min-h-[9rem] resize-y text-sm`}
          />
        </div>
      ) : null}
    </div>
  );
}

export function SavedDeliveryNotesEditor({
  notes,
  onChange,
  saving = false,
  onSave,
}: SavedDeliveryNotesEditorProps) {
  function update(id: string, patch: Partial<SavedDeliveryNote>) {
    onChange(notes.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function remove(id: string) {
    const item = notes.find((n) => n.id === id);
    const name = item?.label.trim() || "this note";
    if (
      !window.confirm(`Delete "${name}"? Click Save notes to keep this change.`)
    ) {
      return;
    }
    onChange(notes.filter((item) => item.id !== id));
  }

  function addNote() {
    onChange([...notes, emptySavedDeliveryNote()]);
  }

  return (
    <div className="space-y-4">
      <div className="admin-delivery-manual-head">
        <span className="admin-delivery-section-icon shrink-0" aria-hidden>
          <MailIcon className="h-4 w-4" />
        </span>
        <h2 className="shrink-0 text-sm font-semibold text-foreground">
          Saved customer notes
        </h2>
        <p className="admin-delivery-manual-head-desc min-w-0 text-xs text-subtle">
          Write customer email notes in advance. Pick one when sending a note
          from Sales → Orders → Manual Gift Card Delivery.
        </p>
        <p className="shrink-0 text-xs text-subtle">
          Changes apply after you click{" "}
          <strong className="text-foreground-muted">Save notes</strong>.
        </p>
        <div className="admin-delivery-manual-head-actions shrink-0">
          <button type="button" onClick={addNote} className="panel-3d-btn panel-3d-btn-sm">
            + Add note
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="panel-3d-btn-ghost panel-3d-btn-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-subtle">
          No saved notes yet. Add a note title and message — you will pick one
          when emailing a customer from an order.
        </p>
      ) : (
        <div className="admin-template-list">
          {notes.map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              index={index}
              onUpdate={(patch) => update(note.id, patch)}
              onRemove={() => remove(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
