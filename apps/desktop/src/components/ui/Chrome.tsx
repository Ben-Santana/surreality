import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return <img src="/surreality-mark.png" alt="" width={size} height={size} className={`block shrink-0 ${className}`} />;
}

export function UiLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`ui-label ${className}`}>{children}</span>;
}

export function UiPanel({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-panel ${className}`} {...props}>{children}</div>;
}

type UiButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "quiet" | "danger";
};

export function UiButton({ tone = "secondary", className = "", children, ...props }: UiButtonProps) {
  return <button className={`ui-button ui-button-${tone} ${className}`} {...props}>{children}</button>;
}
