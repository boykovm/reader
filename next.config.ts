import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'export',          // Outputs static HTML/CSS/JS to an 'out' folder
    images: {
        unoptimized: true,       // GitHub Pages won't support Next.js default image optimization
    },
    basePath: '/reader',
};

export default nextConfig;
