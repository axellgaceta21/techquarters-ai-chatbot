import { createAppConfig } from "../../shared/appConfig.js";

export const appConfig = createAppConfig(import.meta.env);
export const CALENDLY_URL = appConfig.CALENDLY_URL;
export const TENANT_SLUG = appConfig.TENANT_SLUG;
export const API_URLS = {
  chat: `${appConfig.API.BASE_URL}${appConfig.API.CHAT_PATH}`,
  events: appConfig.API.EVENTS_PATH,
};
