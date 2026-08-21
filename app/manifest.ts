import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TOHFA — Premium Brass Handicrafts",
    short_name: "TOHFA",
    description: "Premium lightweight brass artifacts, corporate gifts, and handcrafted decor.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF9F6",
    theme_color: "#3d1113",
    lang: "en-IN",
    dir: "ltr",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
