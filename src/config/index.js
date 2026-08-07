export const config = Object.freeze({
  port: Number(process.env.PORT || 10000),
  databaseUrl: process.env.DATABASE_URL || "",
  editPin: process.env.EDIT_PIN || "1234",
  nodeEnv: process.env.NODE_ENV || "production",
  appName: "ClubPlanner 5.0",
  version: "5.0.0-sprint1"
});

export function validateConfig() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL fehlt. Bitte in Render unter Environment setzen.");
  }
}
