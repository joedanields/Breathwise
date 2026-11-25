import type { ReactNode } from 'react';

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
}

/** Link to another site. Always `rel="noopener noreferrer"` (SECURITY.md §5). */
export function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a href={href} rel="noopener noreferrer" className="underline">
      {children}
    </a>
  );
}
