import "./globals.css";

export const metadata = {
  title: "Glucose Tracker",
  description: "Real-time glucose monitoring dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
