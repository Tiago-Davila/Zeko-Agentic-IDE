import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { t } from "@zeko/i18n";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main>{t("brand.name")}</main>
  </StrictMode>,
);
