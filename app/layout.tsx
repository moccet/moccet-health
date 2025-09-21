import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "moccet - Personal Health AI",
  description: "Small AI models that will track your health. Complete privacy. Expert implementation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
