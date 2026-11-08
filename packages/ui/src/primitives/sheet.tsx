"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop data-slot="sheet-overlay" className="sheet-overlay" />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn("sheet", className)}
        {...props}
      >
        <div className="sheet-handle" aria-hidden="true" />
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("sheet-footer", className)} {...props} />;
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("sheet-title", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("sheet-description", className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle };
