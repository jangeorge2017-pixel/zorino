"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="zor-modal-backdrop">
      <div className="zor-modal-backdrop__shade" onClick={onClose} aria-hidden />
      <div className={cn("zor-modal", className)} role="dialog" aria-modal="true">
        {title ? (
          <div className="zor-modal__header">
            <h2 className="zor-modal__title">{title}</h2>
            <button type="button" className="zor-modal__close" onClick={onClose}>
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
