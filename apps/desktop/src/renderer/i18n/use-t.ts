import { useCallback } from "react";
import { t, type TranslationKey, type TranslationParams } from "@zeko/i18n";

export function useT(): (key: TranslationKey, params?: TranslationParams) => string {
  return useCallback((key, params) => t(key, params), []);
}
