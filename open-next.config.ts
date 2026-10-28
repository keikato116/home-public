import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Next.js を Cloudflare Workers で動かすための設定（@opennextjs/cloudflare）。
// キャッシュ（ISR など）は使っていないので既定のまま。
export default defineCloudflareConfig();
