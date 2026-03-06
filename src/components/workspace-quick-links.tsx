"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrmIcon } from "@/components/ui/crm-icon";

export function WorkspaceQuickLinks() {
  const pathname = usePathname();

  if (pathname !== "/contacts") {
    return null;
  }

  return (
    <div className="workspace-quick-links">
      <Link href="/contacts/new" className="quick-pill">
        <span className="quick-pill-icon" aria-hidden="true"><CrmIcon name="plus" className="crm-icon" /></span>
        <span>Nuevo contacto</span>
      </Link>
      <Link href="/investors/manage" className="quick-pill quick-pill-ghost">
        <span className="quick-pill-icon" aria-hidden="true"><CrmIcon name="edit" className="crm-icon" /></span>
        <span>Gestionar cuentas</span>
      </Link>
    </div>
  );
}
