import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-black/10 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "crit";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-100 text-ink-soft",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    crit: "bg-crit-soft text-crit",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-mono uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variants: Record<string, string> = {
    primary: "bg-accent text-white hover:bg-accent-ink disabled:bg-accent/50",
    secondary: "bg-white text-ink border border-black/15 hover:bg-slate-50",
    danger: "bg-crit text-white hover:opacity-90",
    ghost: "bg-transparent text-accent hover:bg-accent-soft",
  };
  return (
    <button
      className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-[44px] w-full rounded-md border border-black/15 bg-white px-3 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-black/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-[44px] w-full rounded-md border border-black/15 bg-white px-3 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-mono uppercase tracking-wide text-ink-soft">{children}</label>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-ink-soft">{children}</div>;
}
