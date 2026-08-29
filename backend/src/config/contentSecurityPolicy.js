export function buildContentSecurityPolicyDirectives(midtransIsProduction) {
  const midtransScriptSrc = midtransIsProduction
    ? ["https://app.midtrans.com"]
    : ["https://app.sandbox.midtrans.com", "https://app.midtrans.com"];

  const midtransStyleSrc = midtransIsProduction
    ? ["https://app.midtrans.com"]
    : ["https://app.sandbox.midtrans.com", "https://app.midtrans.com"];

  const midtransConnectSrc = midtransIsProduction
    ? ["https://api.midtrans.com"]
    : ["https://api.sandbox.midtrans.com", "https://api.midtrans.com"];

  const midtransFrameSrc = midtransIsProduction
    ? ["https://app.midtrans.com"]
    : ["https://app.sandbox.midtrans.com", "https://app.midtrans.com"];

  return {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      ...midtransScriptSrc,
      "https://apis.google.com",
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      // Cloudflare Web Analytics disisipkan otomatis di origin production.
      "https://static.cloudflareinsights.com",
    ],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", ...midtransStyleSrc],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    connectSrc: [
      "'self'",
      "https://firestore.googleapis.com",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://generativelanguage.googleapis.com",
      ...midtransConnectSrc,
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://www.google-analytics.com",
      "https://analytics.google.com",
      "https://region1.google-analytics.com",
      "https://www.google.com",
      "https://stats.g.doubleclick.net",
      "https://www.facebook.com",
      "https://fcm.googleapis.com",
    ],
    frameSrc: [...midtransFrameSrc, "https://*.firebaseapp.com"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    scriptSrcAttr: ["'none'"],
    ...(midtransIsProduction ? { upgradeInsecureRequests: [] } : {}),
  };
}
