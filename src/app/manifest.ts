import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Great Movember Challenge 2026",
    short_name: "Movember Club",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f0e5",
    theme_color: "#183c32",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
