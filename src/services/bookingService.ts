import { CALENDLY_URL } from "../config/appConfig";
import type { AIResponse } from "../types/ai";
import type { LeadScore } from "./scoringService";

export function shouldOfferBooking(
  response: AIResponse,
  leadScore: LeadScore,
) {
  return Boolean(
    response.booking_offered ||
      response.stage === "booking" ||
      response.signals.wants_to_book ||
      leadScore === "high",
  );
}

export { CALENDLY_URL };