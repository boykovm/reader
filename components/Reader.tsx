"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { BookManifest, TocNode } from "@/lib/content";

export default function Reader({
                                 book,
                                 chapterSlug,
                                 html,
                                 hrefFor,
                               }: {
  book: BookManifest;
  chapterSlug: string;
  html: string;
  // How to build chapter URLs. Committed books default to /read/...;
  // uploaded books pass a builder that targets the /local query route.
  hrefFor?: (chapterSlug: string, anchor?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const linkFor =
      hrefFor ?? ((c: string, a?: string) => `/read/${book.slug}/${c}${a ? `#${a}` : ""}`);

  // Close the drawer after navigating (route or chapter change).
  useEffect(() => {
    setOpen(false);
  }, [pathname, chapterSlug]);

  const index = book.chapters.findIndex((c) => c.slug === chapterSlug);
  const current = book.chapters[index];
  const prev = index > 0 ? book.chapters[index - 1] : null;
  const next = index < book.chapters.length - 1 ? book.chapters[index + 1] : null;

  return (
      <div className="reader">
        <header className="topbar">
          <button
              className="topbar__menu"
              onClick={() => setOpen(true)}
              aria-label="Open table of contents"
          >
            ☰
          </button>
          <Link href="/" className="topbar__home">
            {book.title}
          </Link>
          <span className="topbar__chapter">{current?.title}</span>
        </header>

        {open && <div className="backdrop" onClick={() => setOpen(false)} />}

        <aside className={`toc ${open ? "toc--open" : ""}`}>
          <div className="toc__head">
            <span>{book.title}</span>
            <button onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <nav>
            <TocList nodes={book.toc} currentChapter={chapterSlug} linkFor={linkFor} />
          </nav>
        </aside>

        <main className="page">
          {/* Content is escaped at conversion time and uses only our own tags. */}
          <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />

          <nav className="pager">
            {prev ? (
                <Link href={linkFor(prev.slug)} className="pager__link">
                  ← {prev.title}
                </Link>
            ) : (
                <span />
            )}
            {next ? (
                <Link href={linkFor(next.slug)} className="pager__link pager__link--next">
                  {next.title} →
                </Link>
            ) : (
                <span />
            )}
          </nav>
        </main>
      </div>
  );
}

function TocList({
                   nodes,
                   currentChapter,
                   linkFor,
                 }: {
  nodes: TocNode[];
  currentChapter: string;
  linkFor: (chapterSlug: string, anchor?: string) => string;
}) {
  return (
      <ul className="toc__list">
        {nodes.map((node, i) => {
          const active = node.chapter === currentChapter && !node.anchor;
          return (
              <li key={`${node.chapter}-${node.anchor ?? i}`}>
                <Link
                    href={linkFor(node.chapter, node.anchor)}
                    className={`toc__link ${active ? "toc__link--active" : ""}`}
                >
                  {node.title}
                </Link>
                {node.children?.length ? (
                    <TocList nodes={node.children} currentChapter={currentChapter} linkFor={linkFor} />
                ) : null}
              </li>
          );
        })}
      </ul>
  );
}