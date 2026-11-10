import type { MetadataRoute } from "next";

/** Name and icon for "Add to Home Screen". */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qrio",
    short_name: "Qrio",
    description: "Type any topic and get fresh AI-written quiz questions.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1eee6",
    theme_color: "#f1eee6",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
