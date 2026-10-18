import { Inter } from "next/font/google";
import "./globals.css";
import AuthGate from "./components/AuthGate";
import RegisterServiceWorker from "./components/RegisterServiceWorker";
import PullToRefresh from "./components/PullToRefresh";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "PathFinder",
  description: "Personal task and goal tracker",
  applicationName: "PathFinder",
  // Added to an iPhone home screen: open full-screen, named PathFinder, with a
  // dark status bar (clock, battery) above the app.
  appleWebApp: { capable: true, title: "PathFinder", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

// Fill the whole screen (the tab bar keeps clear of the iPhone home bar), and
// tint the browser / status bar to match the light or dark theme.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#111218" },
  ],
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    // The theme script sets data-theme before React loads, so the server HTML
    // and the page differ on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.variable}>
        <AuthGate>{children}</AuthGate>
        <RegisterServiceWorker />
        <PullToRefresh />
      </body>
    </html>
  );
}
