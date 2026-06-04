// Browser port of convert.ts. Same structure-extraction logic, but it takes an
// ArrayBuffer and returns an in-memory StoredBook instead of writing files.

// iOS Safari <16.4 ships ReadableStream without Symbol.asyncIterator, which pdfjs needs.
if (typeof ReadableStream !== "undefined" && !(ReadableStream.prototype as any)[Symbol.asyncIterator]) {
    Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
        async *value(this: ReadableStream) {
            const reader = this.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) return;
                    yield value;
                }
            } finally {
                reader.releaseLock();
            }
        },
    });
}

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { BookManifest } from "@/lib/content";
import type { StoredBook } from "@/lib/idb";

// pdf.js needs a worker in the browser. Bundlers resolve this URL at build time.
// If your installed pdfjs-dist uses a different worker filename, adjust it here.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
).toString();

interface Anchor { title: string; anchor: string; page: number; }
interface Chapter {
    title: string;
    slug: string;
    startPage: number;
    endPage: number;
    anchors: Anchor[];
}
interface Line { text: string; y: number; size: number; }

export function slugify(input: string, fallback = "section"): string {
    const s = input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return s || fallback;
}

function unique(base: string, used: Set<string>): string {
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) candidate = `${base}-${n++}`;
    used.add(candidate);
    return candidate;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function median(nums: number[]): number {
    if (nums.length === 0) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function extractLines(page: any): Promise<Line[]> {
    const content = await page.getTextContent();
    type Item = { str: string; transform: number[]; height: number; width: number };
    const items: Item[] = content.items.filter((i: any) => typeof i.str === "string");

    const rows: { y: number; items: Item[] }[] = [];
    for (const it of items) {
        if (!it.str.trim()) continue;
        const y = it.transform[5];
        const h = it.height || Math.hypot(it.transform[2], it.transform[3]) || 10;
        const row = rows.find((r) => Math.abs(r.y - y) <= h * 0.5);
        if (row) row.items.push(it);
        else rows.push({ y, items: [it] });
    }

    return rows
        .sort((a, b) => b.y - a.y)
        .map((row) => {
            const ordered = row.items.sort((a, b) => a.transform[4] - b.transform[4]);
            const text = ordered.map((i) => i.str).join("").replace(/\s+/g, " ").trim();
            const size = Math.max(
                ...ordered.map((i) => i.height || Math.hypot(i.transform[2], i.transform[3]) || 0),
            );
            return { text, y: row.y, size };
        })
        .filter((l) => l.text.length > 0);
}

function linesToParagraphs(lines: Line[]): string[] {
    if (lines.length === 0) return [];
    const gaps: number[] = [];
    for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
    const lineHeight = median(gaps.filter((g) => g > 0)) || median(lines.map((l) => l.size)) || 12;

    const paragraphs: string[] = [];
    let buf = "";
    for (let i = 0; i < lines.length; i++) {
        const gapBefore = i > 0 ? lines[i - 1].y - lines[i].y : 0;
        if (i > 0 && gapBefore > lineHeight * 1.6 && buf.trim()) {
            paragraphs.push(buf.trim());
            buf = "";
        }
        if (buf.endsWith("-")) buf = buf.slice(0, -1) + lines[i].text;
        else buf = buf ? `${buf} ${lines[i].text}` : lines[i].text;
    }
    if (buf.trim()) paragraphs.push(buf.trim());
    return paragraphs;
}

async function destToPage(doc: any, dest: any): Promise<number | null> {
    if (!dest) return null;
    let explicit = dest;
    if (typeof dest === "string") explicit = await doc.getDestination(dest);
    if (!Array.isArray(explicit) || !explicit[0]) return null;
    try {
        return (await doc.getPageIndex(explicit[0])) + 1;
    } catch {
        return null;
    }
}

async function chaptersFromOutline(doc: any, outline: any[], numPages: number): Promise<Chapter[]> {
    const chapterSlugs = new Set<string>();
    const chapters: Chapter[] = [];

    async function collectAnchors(items: any[], ids: Set<string>): Promise<Anchor[]> {
        const out: Anchor[] = [];
        for (const item of items ?? []) {
            const page = (await destToPage(doc, item.dest)) ?? 1;
            out.push({
                title: item.title?.trim() || "Section",
                anchor: unique(slugify(item.title || "section"), ids),
                page,
            });
            if (item.items?.length) out.push(...(await collectAnchors(item.items, ids)));
        }
        return out;
    }

    for (const top of outline) {
        const startPage = (await destToPage(doc, top.dest)) ?? (chapters.at(-1)?.endPage ?? 0) + 1;
        const ids = new Set<string>();
        chapters.push({
            title: top.title?.trim() || `Chapter ${chapters.length + 1}`,
            slug: unique(slugify(top.title || `chapter-${chapters.length + 1}`), chapterSlugs),
            startPage,
            endPage: numPages,
            anchors: top.items?.length ? await collectAnchors(top.items, ids) : [],
        });
    }

    for (let i = 0; i < chapters.length; i++) {
        chapters[i].endPage = i + 1 < chapters.length ? chapters[i + 1].startPage - 1 : numPages;
        if (chapters[i].endPage < chapters[i].startPage) chapters[i].endPage = chapters[i].startPage;
    }
    return chapters;
}

async function chaptersFromHeadings(doc: any, numPages: number): Promise<Chapter[]> {
    const allSizes: number[] = [];
    const perPage: Line[][] = [];
    for (let p = 1; p <= numPages; p++) {
        const lines = await extractLines(await doc.getPage(p));
        perPage.push(lines);
        for (const l of lines) allSizes.push(l.size);
    }
    const bodySize = median(allSizes) || 12;

    const chapterSlugs = new Set<string>();
    const chapters: Chapter[] = [];
    for (let p = 1; p <= numPages; p++) {
        for (const line of perPage[p - 1]) {
            const isHeading =
                line.size >= bodySize * 1.25 && line.text.split(/\s+/).length <= 12 && line.text.length > 1;
            if (isHeading) {
                chapters.push({
                    title: line.text,
                    slug: unique(slugify(line.text), chapterSlugs),
                    startPage: p,
                    endPage: numPages,
                    anchors: [],
                });
                break;
            }
        }
    }
    if (chapters.length === 0) {
        chapters.push({ title: "Full Text", slug: "full-text", startPage: 1, endPage: numPages, anchors: [] });
    }
    for (let i = 0; i < chapters.length; i++) {
        chapters[i].endPage = i + 1 < chapters.length ? chapters[i + 1].startPage - 1 : numPages;
        if (chapters[i].endPage < chapters[i].startPage) chapters[i].endPage = chapters[i].startPage;
    }
    return chapters;
}

async function renderChapter(doc: any, chapter: Chapter): Promise<string> {
    const anchorsByPage = new Map<number, Anchor[]>();
    for (const a of chapter.anchors) {
        if (!anchorsByPage.has(a.page)) anchorsByPage.set(a.page, []);
        anchorsByPage.get(a.page)!.push(a);
    }

    const parts: string[] = [`<h1 id="${chapter.slug}">${escapeHtml(chapter.title)}</h1>`];
    for (let p = chapter.startPage; p <= chapter.endPage; p++) {
        for (const a of anchorsByPage.get(p) ?? []) {
            parts.push(`<span id="${a.anchor}" class="anchor" aria-hidden="true"></span>`);
            parts.push(`<h2>${escapeHtml(a.title)}</h2>`);
        }
        const lines = await extractLines(await doc.getPage(p));
        for (const para of linesToParagraphs(lines)) parts.push(`<p>${escapeHtml(para)}</p>`);
    }
    return parts.join("\n");
}

export async function convertPdf(
    data: ArrayBuffer,
    meta: { slug: string; title: string; author?: string },
): Promise<StoredBook> {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
    const numPages = doc.numPages;

    const sample = await extractLines(await doc.getPage(1));
    if (sample.every((l) => l.text.trim() === "")) {
        throw new Error("No text layer found — this looks like a scanned PDF and needs OCR first.");
    }

    const outline = await doc.getOutline();
    const chapters =
        outline && outline.length
            ? await chaptersFromOutline(doc, outline, numPages)
            : await chaptersFromHeadings(doc, numPages);

    const chaptersHtml: Record<string, string> = {};
    for (const ch of chapters) chaptersHtml[ch.slug] = await renderChapter(doc, ch);

    const manifest: BookManifest = {
        slug: meta.slug,
        title: meta.title,
        ...(meta.author ? { author: meta.author } : {}),
        chapters: chapters.map((c) => ({ title: c.title, slug: c.slug })),
        toc: chapters.map((c) => ({
            title: c.title,
            chapter: c.slug,
            children: c.anchors.map((a) => ({ title: a.title, chapter: c.slug, anchor: a.anchor })),
        })),
    };

    return { slug: meta.slug, manifest, chapters: chaptersHtml };
}