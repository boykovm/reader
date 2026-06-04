"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Reader from "@/components/Reader";
import { getStoredBook, type StoredBook } from "@/lib/idb";

function LocalReader() {
    const params = useSearchParams();
    const bookSlug = params.get("book") ?? "";
    const chapterSlug = params.get("chapter") ?? "";
    const [book, setBook] = useState<StoredBook | null | undefined>(undefined);

    useEffect(() => {
        let active = true;
        getStoredBook(bookSlug).then((b) => {
            if (active) setBook(b ?? null);
        });
        return () => {
            active = false;
        };
    }, [bookSlug]);

    if (book === undefined) {
        return (
            <main className="page">
                <p>Loading…</p>
            </main>
        );
    }
    if (book === null) {
        return (
            <main className="page">
                <p>That book isn’t stored on this device.</p>
            </main>
        );
    }

    const chapter =
        book.manifest.chapters.find((c) => c.slug === chapterSlug) ?? book.manifest.chapters[0];
    const html = book.chapters[chapter.slug] ?? "";

    return (
        <Reader
            book={book.manifest}
            chapterSlug={chapter.slug}
            html={html}
            hrefFor={(c, a) => `/local?book=${bookSlug}&chapter=${c}${a ? `#${a}` : ""}`}
        />
    );
}

export default function LocalPage() {
    return (
        <Suspense
            fallback={
                <main className="page">
                    <p>Loading…</p>
                </main>
            }
        >
            <LocalReader />
        </Suspense>
    );
}