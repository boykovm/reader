import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// content/ lives at the project root, alongside app/ and lib/.
const CONTENT_DIR = join(process.cwd(), "content");

export interface TocNode {
  title: string;
  chapter: string; // chapter slug to route to
  anchor?: string; // optional fragment within the chapter
  children?: TocNode[];
}

export interface BookManifest {
  slug: string;
  title: string;
  author?: string;
  chapters: { title: string; slug: string }[];
  toc: TocNode[];
}

/** Every book.json under content/, used to build the library and static params. */
export async function getAllBooks(): Promise<BookManifest[]> {
  let slugs: string[] = [];
  try {
    slugs = await readdir(CONTENT_DIR);
  } catch {
    return []; // no content yet
  }
  const books: BookManifest[] = [];
  for (const slug of slugs) {
    try {
      const raw = await readFile(join(CONTENT_DIR, slug, "book.json"), "utf8");
      books.push(JSON.parse(raw) as BookManifest);
    } catch {
      // not a book directory — skip
    }
  }
  return books.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getBook(slug: string): Promise<BookManifest | null> {
  try {
    const raw = await readFile(join(CONTENT_DIR, slug, "book.json"), "utf8");
    return JSON.parse(raw) as BookManifest;
  } catch {
    return null;
  }
}

/** Raw HTML fragment for one chapter (already escaped at conversion time). */
export async function getChapterHtml(slug: string, chapterSlug: string): Promise<string | null> {
  try {
    return await readFile(join(CONTENT_DIR, slug, `${chapterSlug}.html`), "utf8");
  } catch {
    return null;
  }
}
