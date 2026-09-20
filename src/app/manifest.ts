import type { MetadataRoute } from "next";

// PWA manifest for Adego Beep. Next.js serves this at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Adego Beep",
    short_name: "Adego Beep",
    description: "Real-time Adelaide bus arrivals — accurate GTFS-R timing.",
    start_url: "/",
    display: "standalone",
    background_color: "#1e293b",
    theme_color: "#1e293b",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}