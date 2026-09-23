import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "VisitaTech",
  description: "Sistema de acompanhamento de visitas pós-crédito da Tabôa – Fortalecimento Comunitário.",
  icons: { icon: "/logo.webp" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
