export function tabId(idPrefix: string, value: string): string {
  return `${idPrefix}-${value}-tab`;
}

export function panelId(idPrefix: string, value: string): string {
  return `${idPrefix}-${value}-panel`;
}
