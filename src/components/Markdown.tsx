// Markdown for assistant replies: GFM tables/lists/code, plain-text newlines
// preserved via remark-breaks. Raw HTML stays disabled (react-markdown
// default), so model output cannot inject markup into the page.

import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

const components: Components = {
  p({ children }) {
    return <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  },
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>
  },
  em({ children }) {
    return <em className="italic">{children}</em>
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary break-words underline underline-offset-2"
      >
        {children}
      </a>
    )
  },
  ul({ children }) {
    return <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>
  },
  ol({ children }) {
    return <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>
  },
  li({ children }) {
    return <li className="leading-relaxed [&>p]:my-0">{children}</li>
  },
  code({ className, children }) {
    const block = Boolean(className) || String(children).includes("\n")
    return block ? (
      <code className="font-mono">{children}</code>
    ) : (
      <code className="bg-background/70 rounded px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    )
  },
  pre({ children }) {
    return (
      <pre className="bg-background/70 my-2 overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
        {children}
      </pre>
    )
  },
  table({ children }) {
    return (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs">{children}</table>
      </div>
    )
  },
  th({ children }) {
    return (
      <th className="border-border border-b px-2 py-1 text-left font-medium whitespace-nowrap">
        {children}
      </th>
    )
  },
  td({ children }) {
    return <td className="border-border border-b px-2 py-1 align-top">{children}</td>
  },
  h1({ children }) {
    return <h1 className="mt-3 mb-1 text-base font-semibold">{children}</h1>
  },
  h2({ children }) {
    return <h2 className="mt-3 mb-1 text-sm font-semibold">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="mt-2 mb-1 text-sm font-medium">{children}</h3>
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-border text-muted-foreground my-2 border-l-2 pl-3 italic">
        {children}
      </blockquote>
    )
  },
  hr() {
    return <hr className="border-border my-3" />
  },
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
