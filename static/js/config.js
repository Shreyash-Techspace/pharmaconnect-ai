/* ==========================================================================
   Pharma-Connect AI — API Keys & Configuration
   ============================================================
   INSTRUCTIONS:
   1. Replace the placeholder values below with your real API keys.
   2. Do NOT commit this file to public repositories with real keys.
   ========================================================================== */

window.APP_CONFIG = {

  // ── Google Maps ─────────────────────────────────────────────────────────
  // Get your free key at: https://console.cloud.google.com/
  // Enable: "Maps JavaScript API" in your project.
  GOOGLE_MAPS_API_KEY: "YOUR_GOOGLE_MAPS_API_KEY_HERE",

  // ── EmailJS (Real OTP emails) ────────────────────────────────────────────
  // Sign up free at: https://www.emailjs.com/
  // Steps:
  //   1. Add a Gmail service → copy Service ID below
  //   2. Create email template with variables: {{to_email}}, {{otp_code}}, {{user_name}}
  //      Copy Template ID below
  //   3. Go to Account → copy Public Key below
  EMAILJS_SERVICE_ID:  "YOUR_EMAILJS_SERVICE_ID",
  EMAILJS_TEMPLATE_ID: "YOUR_EMAILJS_TEMPLATE_ID",
  EMAILJS_PUBLIC_KEY:  "YOUR_EMAILJS_PUBLIC_KEY",

};
