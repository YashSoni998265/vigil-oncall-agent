// Superscript source markers that jump to the numbered list in the footer.
export default function Footnote({ ids }: { ids: number[] }) {
  return (
    <sup className="ml-1 align-super text-[11px] font-medium leading-none tracking-normal">
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && <span className="text-faint">,</span>}
          <a
            href={`#src-${id}`}
            aria-label={`Source ${id}`}
            className="rounded-sm text-dim underline-offset-2 transition-colors hover:text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {id}
          </a>
        </span>
      ))}
    </sup>
  );
}
