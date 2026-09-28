import { Inter } from "next/font/google";
import "./globals.css";
import AuthGate from "./components/AuthGate";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "PathFinder",
  description: "Personal task and goal tracker",
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
      </body>
    </html>
  );
}
