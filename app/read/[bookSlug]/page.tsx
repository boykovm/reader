import { notFound, redirect } from "next/navigation";
import { getAllBooks, getBook } from "@/lib/content";

// Pre-render one route per book.
export async function generateStaticParams() {
  const books = await getAllBooks();
  return books.map((b) => ({ bookSlug: b.slug }));
}

export default async function BookPage({
                                         params,
                                       }: {
  params: Promise<{ bookSlug: string }>;
}) {
  const { bookSlug } = await params;
  const book = await getBook(bookSlug);
  if (!book || book.chapters.length === 0) notFound();
  redirect(`/read/${bookSlug}/${book.chapters[0].slug}`);
}