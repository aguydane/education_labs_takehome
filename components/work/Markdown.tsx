"use client";

import type { Element, ElementContent, Root } from "hast";
import { memo } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./work.module.css";

type Plugins = NonNullable<Options["rehypePlugins"]>;

const VOID_TAGS = new Set(["br", "hr", "img", "input"]);

/** Insert `cursor` right after the last visible text in the tree. */
function insertAtEnd(parent: Root | Element, cursor: Element): boolean {
  const children = parent.children as ElementContent[];
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (child.type === "text") {
      if (!child.value.trim()) continue;
      children.splice(i + 1, 0, cursor);
      return true;
    }
    if (child.type === "element") {
      if (!VOID_TAGS.has(child.tagName) && insertAtEnd(child, cursor)) return true;
      children.splice(i + 1, 0, cursor);
      return true;
    }
  }
  return false;
}

/** Rehype plugin: a blinking cursor at the end of the streamed text. */
function rehypeCursor() {
  return (tree: Root) => {
    const cursor: Element = {
      type: "element",
      tagName: "span",
      properties: { className: [styles.cursor], ariaHidden: "true" },
      children: [],
    };
    if (!insertAtEnd(tree, cursor)) tree.children.push(cursor);
  };
}

const REMARK: Plugins = [remarkGfm];
const WITH_CURSOR: Plugins = [rehypeCursor];
const NO_PLUGINS: Plugins = [];

const COMPONENTS: Components = {
  a(props) {
    const { node, ...rest } = props;
    void node;
    return <a {...rest} target="_blank" rel="noreferrer" />;
  },
  table(props) {
    const { node, ...rest } = props;
    void node;
    return (
      <div className="my-2 overflow-x-auto">
        <table {...rest} />
      </div>
    );
  },
};

const PROSE = [
  "prose-helm break-words text-sm leading-relaxed text-ink",
  "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:text-ink-2",
  "[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-panel-2 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-rule [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium",
  "[&_td]:border [&_td]:border-rule [&_td]:px-2 [&_td]:py-1 [&_td]:align-top",
  "[&_hr]:my-3 [&_hr]:border-rule",
].join(" ");

/** Assistant text. Memoized so only the streaming message re-parses on each delta. */
const Markdown = memo(function Markdown({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div className={PROSE}>
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={streaming ? WITH_CURSOR : NO_PLUGINS}
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

export default Markdown;
