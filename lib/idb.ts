"use client";

import type { BookManifest } from "@/lib/content";

export interface StoredBook {
    slug: string;
    manifest: BookManifest;
    chapters: Record<string, string>; // chapterSlug -> HTML fragment
}

const DB_NAME = "pdf-reader";
const STORE = "books";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE, { keyPath: "slug" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function tx<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    return openDb().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const req = run(db.transaction(STORE, mode).objectStore(STORE));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            }),
    );
}

export function saveBook(book: StoredBook): Promise<IDBValidKey> {
    return tx("readwrite", (s) => s.put(book));
}

export async function listStoredBooks(): Promise<BookManifest[]> {
    const all = await tx<StoredBook[]>("readonly", (s) => s.getAll());
    return all.map((b) => b.manifest).sort((a, b) => a.title.localeCompare(b.title));
}

export function getStoredBook(slug: string): Promise<StoredBook | undefined> {
    return tx("readonly", (s) => s.get(slug));
}

export function deleteStoredBook(slug: string): Promise<undefined> {
    return tx("readwrite", (s) => s.delete(slug));
}