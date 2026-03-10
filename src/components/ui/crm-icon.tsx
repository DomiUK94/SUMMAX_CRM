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
  | "edit_record"
  | "warning"
  | "spark"
  | "mail"
  | "phone"
  | "task"
  | "meeting"
  | "more"
  | "back"
  | "settings"
  | "chevron_down"
  | "close"
  | "web"
  | "linkedin";

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
      return <svg {...common}><path d="m14.7 5.3 4 4" /><path d="M4 20h4.8l10-10a2.8 2.8 0 1 0-4-4l-10 10Z" /><path d="M4 15.2V20" /></svg>;
    case "edit_record":
      return <svg {...common}><path d="m14.7 5.3 4 4" /><path d="M4 20h4.8l10-10a2.8 2.8 0 1 0-4-4l-10 10Z" /><path d="M4 15.2V20" /></svg>;
    case "warning":
      return <svg {...common}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></svg>;
    case "spark":
      return <svg {...common}><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" /></svg>;
    case "mail":
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
    case "phone":
      return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3.3a2 2 0 0 1-.6 1.8l-1.4 1.4a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 1.8-.6l3.3.5A2 2 0 0 1 22 16.9Z" /></svg>;
    case "task":
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8" /><path d="M8 12h5" /><path d="M8 16h6" /></svg>;
    case "meeting":
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 10h18" /></svg>;
    case "more":
      return <svg {...common}><path d="M12 12h.01" /><path d="M19 12h.01" /><path d="M5 12h.01" /></svg>;
    case "back":
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
    case "chevron_down":
      return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    case "close":
      return <svg {...common}><path d="m7 7 10 10" /><path d="m17 7-10 10" /></svg>;
    case "web":
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M4 12h16" /><path d="M12 4a13 13 0 0 1 0 16" /><path d="M12 4a13 13 0 0 0 0 16" /></svg>;
    case "linkedin":
      return <svg {...common}><path d="M8 11v5" /><path d="M8 8h.01" /><path d="M12 16v-3a2 2 0 0 1 4 0v3" /><path d="M12 11v5" /><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}
