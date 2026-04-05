import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
// lovable-tagger chỉ dynamic-import trong dev — tránh Vercel phân tích gói này khi build production
export default defineConfig(async ({ mode }) => {
  const plugins = [react()];
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
    },
  };
});
