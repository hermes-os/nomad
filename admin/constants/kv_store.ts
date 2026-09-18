export const SETTINGS_KEYS = [
  'chat.suggestionsEnabled',
  'chat.lastModel',
  'ui.hasVisitedEasySetup',
  'system.earlyAccess',
  'ai.assistantCustomName',
] as const

export type SettingsKey = (typeof SETTINGS_KEYS)[number]
