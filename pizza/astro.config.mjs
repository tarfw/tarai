import { defineConfig } from "astro/config";

// Static-only storefront. A release is the dist/ folder,
// uploaded to R2 and served by the shared sites worker,
// one subdomain per workspace at the root.
export default defineConfig({
  output: "static",
  compressHTML: true,
});
