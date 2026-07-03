const submitFailureMessage =
  "We could not send your project brief right now. Please try again in a moment.";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
  }

  try {
    const {
      name,
      email,
      company,
      website,
      projectBrief,
      currentTools,
      projectScope,
    } = req.body || {};

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanCompany =
      typeof company === "string" ? company.trim() : "";
    const cleanWebsite =
      typeof website === "string" ? website.trim() : "";
    const cleanProjectBrief =
      typeof projectBrief === "string" ? projectBrief.trim() : "";
    const cleanCurrentTools =
      typeof currentTools === "string" ? currentTools.trim() : "";
    const cleanProjectScope =
      typeof projectScope === "string" ? projectScope.trim() : "";

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !cleanName ||
      !cleanEmail ||
      !emailPattern.test(cleanEmail) ||
      !cleanProjectBrief
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide your name, a valid email address, and your project brief.",
      });
    }

    if (!process.env.MAKE_CONTACT_WEBHOOK_URL) {
      console.error("Missing MAKE_CONTACT_WEBHOOK_URL environment variable.");

      return res.status(500).json({
        success: false,
        message: submitFailureMessage,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const makeResponse = await fetch(
        process.env.MAKE_CONTACT_WEBHOOK_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            company: cleanCompany,
            website: cleanWebsite,
            projectBrief: cleanProjectBrief,
            currentTools: cleanCurrentTools,
            projectScope: cleanProjectScope,
            leadSource: "TechQuarters AI Website Contact Form",
            submittedAt: new Date().toISOString(),

            // Make should validate this value with a filter
            // before creating the Airtable record.
            automationSecret: process.env.MAKE_WEBHOOK_SECRET || "",
          }),
        },
      );

      if (!makeResponse.ok) {
        console.error("Make contact webhook failed:", makeResponse.status);

        return res.status(502).json({
          success: false,
          message: submitFailureMessage,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    return res.status(200).json({
      success: true,
      message: "Your project brief has been received.",
    });
  } catch (error) {
    const safeError =
      error instanceof Error ? error.message : "Unknown contact form error";

    console.error("Contact form API error:", safeError);

    return res.status(500).json({
      success: false,
      message: submitFailureMessage,
    });
  }
}
