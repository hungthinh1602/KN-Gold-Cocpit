/** Trang giới thiệu công khai (/gioi-thieu) — bản build riêng, không cần đăng nhập. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LandingPage } from "./features/landing/LandingPage";
import "./styles/landing.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
