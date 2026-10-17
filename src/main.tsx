import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import RuntimeErrorBoundary from "./components/RuntimeErrorBoundary";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>
  </React.StrictMode>,
);
