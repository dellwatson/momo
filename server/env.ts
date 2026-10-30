// Imported first by server/index.ts so that every module sees the .env values.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch {
  // No .env file: the agents run in mock mode.
}
