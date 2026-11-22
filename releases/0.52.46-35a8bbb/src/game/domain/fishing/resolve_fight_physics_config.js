// Composition passes a config carrying its FightPhysicsConfigAdapter (CONFIG or ConfigProvider);
// it is read on every call, so DEV overrides stay live.
export function resolveFightPhysicsConfig(config) {
  if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;
  return null;
}
