export const syncState = {
  running: false,
  phase: "idle",
  progress: "Noch nicht synchronisiert",
  total: 0,
  processed: 0,
  imported: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
  errors: [],
  error: null,
  startedAt: null,
  finishedAt: null,
  lastActivity: null
};

export function resetSyncState() {
  Object.assign(syncState, {
    running: true,
    phase: "discovery",
    progress: "Starte Synchronisierung …",
    total: 0,
    processed: 0,
    imported: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastActivity: new Date().toISOString()
  });
}

export function syncLog(message, phase = syncState.phase) {
  syncState.phase = phase;
  syncState.progress = message;
  syncState.lastActivity = new Date().toISOString();
  console.log(`[FUSSBALL-4.0] ${message}`);
}

export function syncProblem(externalId, url, message) {
  const item = { externalId: externalId || "", url: url || "", message, at: new Date().toISOString() };
  syncState.errors.push(item);
  if (syncState.errors.length > 30) syncState.errors.shift();
  console.warn(`[FUSSBALL-4.0] ${externalId || "?"}: ${message}`);
}
