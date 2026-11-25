interface SkipLinkProps {
  targetId: string;
}

/** First focusable element: lets keyboard users jump past the header (WCAG 2.4.1). */
export function SkipLink({ targetId }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-4 focus:font-medium focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}
