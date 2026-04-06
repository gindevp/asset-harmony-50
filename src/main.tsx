import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/** Đảm bảo tab trình duyệt dùng đúng `/favicon.svg` (kể cả khi `base` khác `/`). */
function ensureTabFavicon() {
  const base = import.meta.env.BASE_URL;
  const href = `${base}favicon.svg`.replace(/([^:]\/)\/+/g, "$1");
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  link.href = href;
  link.setAttribute("sizes", "any");
}

ensureTabFavicon();

createRoot(document.getElementById("root")!).render(<App />);
