"use client";

import { memo, useState } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

interface MarkdownProps {
  content: string;
  className?: string;
}

const CodeBlock = ({
  language,
  value,
}: {
  language: string;
  value: string;
}) => {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg overflow-hidden my-6 border border-border/40 shadow-sm bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-2 text-xs text-zinc-400 font-mono">
            {language || "text"}
          </span>
        </div>
        <button
          onClick={onCopy}
          className="p-1.5 rounded hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          title="复制代码"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Code Area */}
      {/* 
         force fit width and wrap to avoid horizontal scrollbar as per user request 
         Using wrapLongLines={true} in SyntaxHighlighter
      */}
      <div className="text-sm">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          PreTag="div"
          showLineNumbers={true}
          wrapLines={true}
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent", // Use container bg
            fontSize: "0.875rem",
            lineHeight: "1.6",
          }}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: "#6e6e6e",
            textAlign: "right",
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const Markdown = memo(({ content, className = "" }: MarkdownProps) => {
  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match && !className; // Basic heuristic, or check props.inline if strictly typed (types vary by version)
      // react-markdown 9+ usually passes `inline` boolean prop, but 8 might not.
      // Let's assume standard behavior: if block, it has language or comes from a block context.
      // Actually `inline` is often strictly passed.

      const inline = (props as any).inline;
      const value = String(children).replace(/\n$/, "");

      if (!inline && match) {
        return (
          <CodeBlock
            language={match[1]}
            value={value}
          />
        );
      }

      if (!inline && !match && String(children).includes("\n")) {
        // Fallback for code blocks without language
        return (
          <CodeBlock language="text" value={value} />
        )
      }

      return (
        <code
          className={`bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground border border-border/30 ${className || ""}`}
          {...props}
        >
          {children}
        </code>
      );
    },
    table({ children }) {
      return (
        <div className="my-6 w-full overflow-hidden rounded-lg border border-border shadow-sm">
          <table className="w-full text-sm text-left">{children}</table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-muted/50 border-b border-border">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="px-4 py-3 font-semibold text-foreground align-middle [&:has([role=checkbox])]:pr-0">
          {children}
        </th>
      );
    },
    tbody({ children }) {
      return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
    },
    tr({ children }) {
      return (
        <tr className="border-b border-border/50 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
          {children}
        </tr>
      );
    },
    td({ children }) {
      return (
        <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
          {children}
        </td>
      );
    },
  };

  return (
    <div className={`prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

Markdown.displayName = "Markdown";

export default Markdown;
