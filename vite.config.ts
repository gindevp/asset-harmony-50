import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** CI (Vercel) ít log trong lúc transform — in ngay khi Rollup bắt đầu + mỗi N module (không phụ thuộc biến VERCEL) */
function transformProgressLogger(): Plugin {
  let count = 0;
  return {
    name: "transform-progress-logger",
    buildStart() {
      console.log("[vite] rollup: buildStart");
    },
    transform() {
      count++;
      if (count % 200 === 0) {
        console.log(`[vite] rollup: ${count} modules transformed`);
      }
      return undefined;
    },
    buildEnd() {
      console.log(`[vite] rollup: buildEnd (transforms=${count})`);
    },
  };
}

// https://vitejs.dev/config/
// lovable-tagger chỉ dynamic-import trong dev — tránh Vercel phân tích gói này khi build production
export default defineConfig(async ({ mode }) => {
  const plugins = [react()];
  if (mode === "production") {
    plugins.push(transformProgressLogger());
  }
  if (mode === "development") {
    const { componentTagger } = await import("lovable-tagger");
    plugins.push(componentTagger());
  }
  return {
    /** Gốc URL khi deploy (vd: `'/harmony/'` nếu ứng dụng tại https://domain.com/harmony/). Phải khớp cấu hình reverse-proxy / static host. */
    base: "/",
    server: {
      host: "::",
      port: 5173,
      proxy: {
        "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
        "/management": { target: "http://127.0.0.1:8080", changeOrigin: true },
      },
      hmr: {
        overlay: false,
      },
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    build: {
      reportCompressedSize: false,
      /** Giảm song song file khi build — hạ đỉnh RAM (tránh OOM im lặng trên CI 2 vCPU / 8GB) */
      rollupOptions: {
        maxParallelFileOps: 2,
      },
    },
  };
});
