import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createAppConfig } from "../../shared/appConfig.js";

const FALLBACK_ENV_FILES = [
  ".vercel/.env.development.local",
  ".env.local",
  ".env",
];

function hasNonEmptyEnvValue(key) {
  return typeof process.env[key] === "string" && process.env[key].trim().length > 0;
}

function loadFallbackEnvFiles() {
  for (const relativePath of FALLBACK_ENV_FILES) {
    const envPath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(envPath)) continue;

    const parsed = dotenv.parse(fs.readFileSync(envPath));
    for (const [key, value] of Object.entries(parsed)) {
      if (!hasNonEmptyEnvValue(key)) {
        process.env[key] = value;
      }
    }
  }
}

loadFallbackEnvFiles();

const appConfig = createAppConfig(process.env);

export const env = Object.freeze({
  ...appConfig,
  PORT: process.env.PORT || 3001,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || "",
  APP_TIMEZONE: process.env.APP_TIMEZONE || "Asia/Manila",
});
