import type { NextConfig } from "next";

/**
 * Next.js configuration.
 * The `headers()` block adds SECURITY HEADERS to every response - the same
 * job the "helmet" middleware does in Express apps. Each header tells the
 * browser to refuse a common attack:
 *   X-Content-Type-Options  -> don't guess file types (stops MIME sniffing)
 *   X-Frame-Options         -> don't embed this app in iframes (clickjacking)
 *   Referrer-Policy         -> limit what URL info leaks to other sites
 *   Strict-Transport-Security -> force HTTPS on future visits (production)
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
