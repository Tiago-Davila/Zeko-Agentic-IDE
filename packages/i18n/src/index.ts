import enJson from "./en.json" with { type: "json" };

export const en = enJson;
export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number>;

export function t(key: TranslationKey, params: TranslationParams = {}): string {
  return en[key].replace(/\{([^}]+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}
