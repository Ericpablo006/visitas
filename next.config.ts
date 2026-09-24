import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    // Em dev, o Fast Refresh do Next/webpack usa eval() para HMR — sem
    // 'unsafe-eval' o React nem consegue anexar os event handlers (os
    // formulários ficam "travados", sem quebrar visualmente). Isso não é um
    // risco real (servidor de dev não é exposto), então relaxamos só aqui.
    const scriptSrc = process.env.NODE_ENV === "production" ? "script-src 'self' 'unsafe-inline';" : "script-src 'self' 'unsafe-inline' 'unsafe-eval';";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            // img-src abre pros tiles do OpenStreetMap (mini-mapa de localização da propriedade
            // em /admin/agenda — ver src/components/PropertyMapPicker.tsx).
            value: `default-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; ${scriptSrc} style-src 'self' 'unsafe-inline'; frame-ancestors 'none';`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
