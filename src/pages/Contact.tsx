import { useState, type ChangeEvent, type FormEvent } from "react";
import PageHero from "../components/ui/PageHero";
import Icon from "../components/ui/Icon";
import { useChat } from "../hooks/useChat";
import { CALENDLY_URL } from "../config/appConfig";

type ContactFormData = {
  name: string;
  email: string;
  company: string;
  website: string;
  projectBrief: string;
  currentTools: string;
  projectScope: string;
};

type ContactFormErrors = Partial<Record<keyof ContactFormData, string>>;

const initialFormData: ContactFormData = {
  name: "",
  email: "",
  company: "",
  website: "",
  projectBrief: "",
  currentTools: "",
  projectScope: "",
};

const submitFailureMessage =
  "We could not send your project brief right now. Please try again in a moment.";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeWebsite(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";

  return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

function isValidUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function validateForm(data: ContactFormData) {
  const nextData: ContactFormData = {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    company: data.company.trim(),
    website: normalizeWebsite(data.website),
    projectBrief: data.projectBrief.trim(),
    currentTools: data.currentTools.trim(),
    projectScope: data.projectScope,
  };
  const nextErrors: ContactFormErrors = {};

  if (!nextData.name) nextErrors.name = "Please enter your name.";
  if (!nextData.email || !emailPattern.test(nextData.email)) {
    nextErrors.email = "Please enter a valid email address.";
  }
  if (nextData.website && !isValidUrl(nextData.website)) {
    nextErrors.website = "Please enter a valid website URL.";
  }
  if (!nextData.projectBrief) {
    nextErrors.projectBrief = "Please describe what you would like to build.";
  }
  if (!nextData.projectScope) {
    nextErrors.projectScope = "Please select an estimated project scope.";
  }

  return { nextData, nextErrors };
}

export default function Contact() {
  const { openChat, trackBookingClick } = useChat();
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function updateField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    const fieldName = name as keyof ContactFormData;

    setFormData((current) => ({ ...current, [fieldName]: value }));
    setErrors((current) => ({ ...current, [fieldName]: undefined }));
    setSubmitError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const { nextData, nextErrors } = validateForm(formData);

    setFormData(nextData);
    setErrors(nextErrors);
    setSubmitError("");

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextData.name,
          email: nextData.email,
          company: nextData.company,
          website: nextData.website,
          projectBrief: nextData.projectBrief,
          currentTools: nextData.currentTools,
          projectScope: nextData.projectScope,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.message || submitFailureMessage);
      }

      setFormData(initialFormData);
      setErrors({});
      setIsSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message ? error.message : submitFailureMessage,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function fieldError(fieldName: keyof ContactFormData) {
    return errors[fieldName];
  }

  function fieldA11y(fieldName: keyof ContactFormData) {
    const error = fieldError(fieldName);

    return {
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? `${fieldName}-error` : undefined,
    };
  }

  return (
    <>
      <PageHero
        eyebrow="START A PROJECT"
        title="Tell Us What You Want to Improve."
        copy="Share the process, bottleneck, or idea you're thinking about. We'll help you identify the clearest next step."
      />
      <section className="section page-section">
        <div className="container contact-grid">
          <div className="contact-copy">
            <span className="eyebrow">LET'S TALK</span>
            <h2>Build the Right System First.</h2>
            <p>
              Useful details include what happens today, where work gets stuck, which tools are involved,
              and what a better outcome looks like.
            </p>
            <div className="contact-point">
              <Icon name="chat" />
              <div>
                <b>Prefer a faster conversation?</b>
                <button type="button" onClick={openChat}>Start a chat <Icon name="arrow" /></button>
              </div>
            </div>
            <div className="contact-point">
              <Icon name="calendar" />
              <div>
                <b>Strategy call</b>
                <a href={CALENDLY_URL} target="_blank" rel="noreferrer" onClick={trackBookingClick}>
                  Book a 30-minute strategy call <Icon name="arrow" />
                </a>
              </div>
            </div>
          </div>
          {isSubmitted ? (
            <div className="form-success glass-card" aria-live="polite">
              <Icon name="check" />
              <h2>Message received.</h2>
              <p>Thanks - your project brief is ready to send. We'll review the details and get back to you shortly.</p>
              <button className="button button-secondary" type="button" onClick={() => setIsSubmitted(false)}>
                Send another
              </button>
            </div>
          ) : (
            <form className="contact-form glass-card" onSubmit={submit} noValidate>
              <div className="field-row">
                <label htmlFor="name">
                  Name <span className="required-mark">*</span>
                  <input
                    id="name"
                    required
                    type="text"
                    name="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={updateField}
                    {...fieldA11y("name")}
                  />
                  {fieldError("name") ? <span className="contact-field-error" id="name-error" role="alert">{fieldError("name")}</span> : null}
                </label>
                <label htmlFor="email">
                  Email <span className="required-mark">*</span>
                  <input
                    id="email"
                    required
                    type="email"
                    name="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={updateField}
                    {...fieldA11y("email")}
                  />
                  {fieldError("email") ? <span className="contact-field-error" id="email-error" role="alert">{fieldError("email")}</span> : null}
                </label>
              </div>
              <div className="field-row">
                <label htmlFor="company">
                  Company
                  <input
                    id="company"
                    type="text"
                    name="company"
                    placeholder="Company name"
                    value={formData.company}
                    onChange={updateField}
                  />
                </label>
                <label htmlFor="website">
                  Website
                  <input
                    id="website"
                    type="url"
                    name="website"
                    placeholder="https://yourwebsite.com"
                    value={formData.website}
                    onChange={updateField}
                    {...fieldA11y("website")}
                  />
                  {fieldError("website") ? <span className="contact-field-error" id="website-error" role="alert">{fieldError("website")}</span> : null}
                </label>
              </div>
              <label htmlFor="projectBrief">
                What do you want to build? <span className="required-mark">*</span>
                <textarea
                  id="projectBrief"
                  required
                  name="projectBrief"
                  rows={6}
                  placeholder="Tell us about the system, automation, website, chatbot, workflow, or business problem you want to solve."
                  value={formData.projectBrief}
                  onChange={updateField}
                  {...fieldA11y("projectBrief")}
                />
                {fieldError("projectBrief") ? <span className="contact-field-error" id="projectBrief-error" role="alert">{fieldError("projectBrief")}</span> : null}
              </label>
              <label htmlFor="currentTools">
                Current tools / platforms
                <input
                  id="currentTools"
                  name="currentTools"
                  placeholder="For example: Airtable, HubSpot, GoHighLevel, Google Sheets, Notion, Zapier, Make, Slack, Calendly"
                  value={formData.currentTools}
                  onChange={updateField}
                />
              </label>
              <label htmlFor="projectScope">
                Estimated project scope <span className="required-mark">*</span>
                <select
                  id="projectScope"
                  name="projectScope"
                  required
                  value={formData.projectScope}
                  onChange={updateField}
                  {...fieldA11y("projectScope")}
                >
                  <option value="" disabled>Select estimated scope</option>
                  <option>Small Project</option>
                  <option>Medium Project</option>
                  <option>Large Project</option>
                  <option>Ongoing Support</option>
                  <option>Not Sure Yet</option>
                </select>
                {fieldError("projectScope") ? <span className="contact-field-error" id="projectScope-error" role="alert">{fieldError("projectScope")}</span> : null}
              </label>
              {submitError ? (
                <p className="contact-submit-error" role="alert" aria-live="assertive">
                  {submitError}
                </p>
              ) : null}
              <button className="button button-primary button-large" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Preparing Your Brief..." : "Send Project Brief"}
                {!isSubmitting ? <Icon name="arrow" /> : null}
              </button>
              <small>By submitting, you agree to be contacted about your project.</small>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
