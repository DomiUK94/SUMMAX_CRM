import type { SVGProps } from "react";

type CrmIconName =
  | "dashboard"
  | "overview"
  | "search"
  | "contacts"
  | "companies"
  | "deals"
  | "activity"
  | "imports"
  | "exports"
  | "changelog"
  | "feedback"
  | "users"
  | "account"
  | "report"
  | "plus"
  | "edit"
  | "warning"
  | "spark";

export function CrmIcon({ name, className, ...props }: { name: CrmIconName } & SVGProps<SVGSVGElement>) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    ...props
  };

  switch (name) {
    case "dashboard":
      return <svg {...common}><rect x="3" y="4" width="7" height="7" rx="2" /><rect x="14" y="4" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="8" rx="2" /><rect x="3" y="14" width="7" height="6" rx="2" /></svg>;
    case "overview":
      return <svg {...common}><path d="M4 19h16" /><path d="M6 16V9" /><path d="M12 16V5" /><path d="M18 16v-4" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>;
    case "contacts":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11a3 3 0 1 0 0-6" /><path d="M21 21v-2a3.5 3.5 0 0 0-2-3.2" /></svg>;
    case "companies":
      return <svg {...common}><path d="M4 21V7a2 2 0 0 1 2-2h8v16" /><path d="M14 9h4a2 2 0 0 1 2 2v10" /><path d="M8 9h2" /><path d="M8 13h2" /><path d="M8 17h2" /></svg>;
    case "deals":
      return <svg {...common}><path d="M4 7h8" /><path d="M4 12h12" /><path d="M4 17h16" /><circle cx="15" cy="7" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="9" cy="17" r="2" /></svg>;
    case "activity":
      return <svg {...common}><path d="M3 12h4l2-5 4 10 2-5h6" /></svg>;
    case "imports":
      return <svg {...common}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>;
    case "exports":
      return <svg {...common}><path d="M12 21V9" /><path d="m7 14 5-5 5 5" /><path d="M5 3h14" /></svg>;
    case "changelog":
      return <svg {...common}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>;
    case "feedback":
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case "users":
      return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "account":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "report":
      return <svg {...common}><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v5h5" /><path d="M10 13h6" /><path d="M10 17h6" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case "edit":
      return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "warning":
      return <svg {...common}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></svg>;
    case "spark":
      return <svg {...common}><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}
