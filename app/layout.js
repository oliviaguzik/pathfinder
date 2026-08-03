import "./globals.css";
import NavBar from "./components/NavBar";

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
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <NavBar />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
