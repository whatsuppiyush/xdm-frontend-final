"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider data-oid="6wtag4m">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} data-oid="1txexl.">
            <div className="grid gap-1" data-oid="9uv76ef">
              {title && <ToastTitle data-oid="4mumrtw">{title}</ToastTitle>}
              {description && (
                <ToastDescription data-oid="r36lzlg">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose data-oid="pachk.f" />
          </Toast>
        );
      })}
      <ToastViewport data-oid="k5zplve" />
    </ToastProvider>
  );
}
