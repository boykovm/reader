"use client";

import dynamic from "next/dynamic";

const UploadBooks = dynamic(() => import("@/components/UploadBooks"), { ssr: false });

export default function UploadBooksWrapper() {
    return <UploadBooks />;
}