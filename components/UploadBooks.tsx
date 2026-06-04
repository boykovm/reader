"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BookManifest } from "@/lib/content";
import { convertPdf, slugify } from "@/lib/convert-client";
import { deleteStoredBook, listStoredBooks, saveBook } from "@/lib/idb";

export default function UploadBooks() {
    const [books, setBooks] = useState<BookManifest[]>([]);
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    async function refresh() {
        try {
            setBooks(await listStoredBooks());
        } catch {
            // IndexedDB unavailable (e.g. private mode) — leave list empty.
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    async function handleFiles(files: FileList | null) {
        if (!files?.length) return;
        setBusy(true);
        for (const file of Array.from(files)) {
            const base = file.name.replace(/\.pdf$/i, "");
            try {
                setStatus(`Converting “${base}”…`);
                const buffer = await file.arrayBuffer();
                const slug = `${slugify(base)}-${Date.now().toString(36)}`;
                await saveBook(await convertPdf(buffer, { slug, title: base }));
            } catch (err) {
                setStatus(`Couldn’t convert “${base}”: ${(err as Error).message}`);
                setBusy(false);
                await refresh();
                return;
            }
        }
        setStatus("");
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
        await refresh();
    }

    async function remove(slug: string) {
        await deleteStoredBook(slug);
        await refresh();
    }

    return (
        <section className="uploads">
            <div className="uploads__head">
                <h2>Your uploads</h2>
                <label className={`uploads__btn ${busy ? "is-busy" : ""}`}>
                    {busy ? "Working…" : "Upload PDF"}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf"
                        multiple
                        hidden
                        disabled={busy}
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                </label>
            </div>

            {status && <p className="uploads__status">{status}</p>}

            {books.length === 0 ? (
                <p className="uploads__empty">
                    Books you upload are converted in your browser and saved on this device only.
                </p>
            ) : (
                <ul className="library__grid">
                    {books.map((book) => (
                        <li key={book.slug}>
                            <Link
                                href={`/local?book=${book.slug}&chapter=${book.chapters[0]?.slug ?? ""}`}
                                className="card"
                            >
                                <span className="card__title">{book.title}</span>
                                <span className="card__meta">{book.chapters.length} chapters</span>
                            </Link>
                            <button className="uploads__delete" onClick={() => remove(book.slug)}>
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}