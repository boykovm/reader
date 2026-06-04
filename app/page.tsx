import Link from "next/link";
import { getAllBooks } from "@/lib/content";
import UploadBooks from "@/components/UploadBooks";

export default async function Home() {
    const books = await getAllBooks();
    return (
        <main className="library">
            <header className="library__head">
                <h1>Library</h1>
                <p>
                    {books.length} {books.length === 1 ? "book" : "books"}
                </p>
            </header>

            {books.length === 0 ? (
                <p className="library__empty">
                    No books yet. Run the converter, then drop its output into <code>content/</code>.
                </p>
            ) : (
                <ul className="library__grid">
                    {books.map((book) => (
                        <li key={book.slug}>
                            <Link
                                href={`/read/${book.slug}/${book.chapters[0]?.slug ?? ""}`}
                                className="card"
                            >
                                <span className="card__title">{book.title}</span>
                                {book.author && <span className="card__author">{book.author}</span>}
                                <span className="card__meta">{book.chapters.length} chapters</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            <UploadBooks />
        </main>
    );
}