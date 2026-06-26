import dotenv from "dotenv";
import { createAppConfig } from "../../shared/appConfig.js";

dotenv.config();

const appConfig = createAppConfig(process.env);

export const env = Object.freeze({
  ...appConfig,
  PORT: process.env.PORT || 3001,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
});