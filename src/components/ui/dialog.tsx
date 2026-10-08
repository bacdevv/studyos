"use client";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="modal-overlay" />
        <Primitive.Content className="modal-content">
          <Primitive.Title className="modal-title">{title}</Primitive.Title>
          <Primitive.Description className="muted modal-description">
            {description}
          </Primitive.Description>
          {children}
          <Primitive.Close
            className="icon-button modal-close"
            aria-label="Close dialog"
          >
            <X size={18} />
          </Primitive.Close>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
