import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAZZI",
  description: "Marketplace de aulas práticas de direção.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
