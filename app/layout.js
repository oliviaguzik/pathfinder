import "./globals.css";

export const metadata = {
  title: "Task Tracker",
  description: "Personal task and goal tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="topnav">
          <a href="/" className="brand">Task Tracker</a>
          <div className="navlinks">
            <a href="/">Tasks</a>
            <a href="/goals">Goals</a>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
