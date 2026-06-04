import { notFound } from "next/navigation";
import { getAllBooks, getBook, getChapterHtml } from "@/lib/content";
import Reader from "@/components/Reader";

// Pre-render every chapter of every book -> fully static, shareable URLs.
export async function generateStaticParams() {
    const books = await getAllBooks();
    return books.flatMap((b) =>
        b.chapters.map((c) => ({ bookSlug: b.slug, chapterSlug: c.slug })),
    );
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: Promise<{ bookSlug: string; chapterSlug: string }>;
}) {
    const { bookSlug, chapterSlug } = await params;
    const book = await getBook(bookSlug);
    if (!book) return { title: "Reader" };
    const chapter = book.chapters.find((c) => c.slug === chapterSlug);
    return { title: `${chapter?.title ?? ""} — ${book.title}` };
}

export default async function ChapterPage({
                                              params,
                                          }: {
    params: Promise<{ bookSlug: string; chapterSlug: string }>;
}) {
    const { bookSlug, chapterSlug } = await params;
    const book = await getBook(bookSlug);
    if (!book) notFound();
    const html = await getChapterHtml(bookSlug, chapterSlug);
    if (html === null) notFound();
    return <Reader book={book} chapterSlug={chapterSlug} html={html} />;
}