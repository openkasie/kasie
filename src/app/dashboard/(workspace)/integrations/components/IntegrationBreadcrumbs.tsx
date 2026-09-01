"use client";

import Link from "next/link";
import { integrationBreadcrumbLinkHover } from "./integration-card-styles";

type Crumb = {
  label: string;
  href?: string;
};

type IntegrationBreadcrumbsProps = {
  crumbs: Crumb[];
};

export function IntegrationBreadcrumbs({ crumbs }: IntegrationBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[var(--fg-muted)]">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className={integrationBreadcrumbLinkHover}>
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[var(--fg)]">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
