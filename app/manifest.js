// The app description phones read when PathFinder is added to the home screen:
// its name, icons, colours, and to open full-screen without browser bars.
export default function manifest() {
  return {
    name: "PathFinder",
    short_name: "PathFinder",
    description: "Your tasks, events and goals in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#111218",
    theme_color: "#111218",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
