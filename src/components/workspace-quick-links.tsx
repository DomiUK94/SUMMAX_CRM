"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrmIcon } from "@/components/ui/crm-icon";

export function WorkspaceQuickLinks() {
  const pathname = usePathname();

  if (pathname === "/contacts") {
    return (
      <div className="workspace-quick-links">
        <Link href="/contacts/new" className="quick-pill">
          <span className="quick-pill-icon" aria-hidden="true"><CrmIcon name="plus" className="crm-icon" /></span>
          <span>Nuevo</span>
        </Link>
        <Link href="/contacts/manage" className="quick-pill quick-pill-ghost">
          <span className="quick-pill-icon" aria-hidden="true"><CrmIcon name="edit" className="crm-icon" /></span>
          <span>Modificar</span>
        </Link>
        <Link href="/contacts/duplicates" className="quick-pill quick-pill-danger">
          <span className="quick-pill-icon" aria-hidden="true"><CrmIcon name="warning" className="crm-icon" /></span>
          <span>Posibles duplicados</span>
        </Link>
      </div>
    );
  }

  if (pathname === "/investors") {
    return (
      <div className="workspace-quick-links">
        <Link href="/investors/new" className="quick-pill">
          <span className="quick-pill-icon" aria-hidden="true"><CrmIcon name="plus" className="crm-icon" /></span>
          <span>Nuevo</span>
        </Link>
        <Link href="/investors/manage" className="quick-pill quick-pill-ghost">
          <span className="quick-pill-icon" aria-hidden="true"><CrmIcon name="edit" className="crm-icon" /></span>
          <span>Modificar</span>
        </Link>
      </div>
    );
  }

  return null;
}
