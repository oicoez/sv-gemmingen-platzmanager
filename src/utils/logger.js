function stamp() {
  return new Date().toISOString();
}

export const logger = {
  info(message, meta) {
    console.log(`[CP5] ${stamp()} INFO  ${message}`, meta ?? "");
  },
  warn(message, meta) {
    console.warn(`[CP5] ${stamp()} WARN  ${message}`, meta ?? "");
  },
  error(message, meta) {
    console.error(`[CP5] ${stamp()} ERROR ${message}`, meta ?? "");
  }
};
