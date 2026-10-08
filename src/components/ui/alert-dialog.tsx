"use client";
import * as A from "@radix-ui/react-alert-dialog";
export function ConfirmDelete({
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className="modal-overlay" />
        <A.Content className="modal-content">
          <A.Title className="modal-title">Delete this record?</A.Title>
          <A.Description className="muted">
            This permanently deletes the record. Deleting a habit also removes
            its daily entries.
          </A.Description>
          <div className="modal-actions">
            <A.Cancel className="button" disabled={busy}>
              Cancel
            </A.Cancel>
            <button
              className="button danger"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? "Deleting…" : "Delete record"}
            </button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
