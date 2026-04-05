import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** Trên Vercel, giai đoạn transforming... không in thêm dòng — log mỗi N module để tránh tưởng build treo */
function transformProgressLogger(): Plugin {
  let count = 0;
  return {
    name: "transform-progress-logger",
    transform() {
      count++;
      if (count % 500 === 0) {
        console.log(`[vite] transforming... ${count} modules processed`);
      }
      return null;
    },
  };
}

// https://vitejs.dev/config/
// lovable-tagger chỉ dynamic-import trong dev — tránh Vercel phân tích gói này khi build production
export default defineConfig(async ({ mode }) => {
  const plugins = [react()];
  if (process.env.VERCEL === "1") {
    plugins.push(transformProgressLogger());
  }
  if (mode === "development") {
    const { componentTagger } = await import("lovable-tagger");
    plugins.push(componentTagger());
  }
  return {
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
        maxParallelFileOps: 4,
      },
    },
  };
});
