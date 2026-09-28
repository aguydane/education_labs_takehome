"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const PLUGINS = [remarkGfm];

const COMPONENTS: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent-ink underline underline-offset-2">
      {children}
    </a>
  ),
};

/** Tables and quotes aren't covered by .prose-helm; keep them quiet. */
const EXTRA =
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:text-ink-2 " +
  "[&_table]:my-2 [&_table]:border-collapse [&_th]:border [&_th]:border-rule [&_th]:px-2 [&_th]:py-1 [&_th]:text-left " +
  "[&_td]:border [&_td]:border-rule [&_td]:px-2 [&_td]:py-1 [&_strong]:font-semibold";

/** A caret after the last rendered block while text is still arriving. */
const CURSOR =
  "[&>*:last-child]:after:ml-0.5 [&>*:last-child]:after:animate-pulse " +
  "[&>*:last-child]:after:text-accent [&>*:last-child]:after:content-['▍']";

export function Cursor() {
  return <span aria-hidden className="inline-block animate-pulse text-sm text-accent">{"▍"}</span>;
}

export default function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  if (streaming && !text.trim()) {
    return (
      <div className="prose-helm text-sm leading-relaxed">
        <Cursor />
        <span className="sr-only">Claude is writing</span>
      </div>
    );
  }
  return (
    <div
      className={`prose-helm text-sm leading-relaxed break-words ${EXTRA} ${streaming ? CURSOR : ""}`}
      aria-busy={streaming || undefined}
    >
      <ReactMarkdown remarkPlugins={PLUGINS} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
