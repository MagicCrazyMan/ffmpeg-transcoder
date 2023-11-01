import "@arco-design/web-react/dist/css/arco.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import "./index.less";
import { router } from "./router/index.tsx";

/**
 * Disable contextmenu
 */
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});
/**
 * Disable F5
 */
document.addEventListener("keydown", (e) => {
  if (e.key === "F5") {
    e.preventDefault();
  }
});
/**
 * Disable opening any file using drag and drop
 */
document.addEventListener("dragover", (e: DragEvent) => {
  e.preventDefault();
});
document.addEventListener("drop", (e: DragEvent) => {
  e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router}></RouterProvider>
  </React.StrictMode>
);
