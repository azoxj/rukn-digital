/* =========================================================
   AZENK — central site configuration
   ---------------------------------------------------------
   This is the ONLY place to change contact details.
   Every WhatsApp button, the contact form and the floating
   button read WHATSAPP_NUMBER from here.

   - WHATSAPP_NUMBER: international format, digits only, no "+"
     (e.g. "9665XXXXXXXX"). If it still contains "X" the site
     treats it as a placeholder and does NOT publish a wa.me link.
   - TIKTOK_URL: full profile link (https://www.tiktok.com/@...).
     Leave it empty until the official account link is confirmed;
     the icon then shows as "coming soon" instead of a dead link.
   - DEMO_CENTER_URL: base URL of AZENK Demo Center (a server app in
     platform/apps/democenter), e.g. "https://demo.azenk.sa". Used only for
     the «تسجيل الدخول إلى Demo Center» link (hidden while empty).
     «اطلب Demo» always opens regular WhatsApp with a ready message; staff
     then create the demo account by hand. No credentials ever go in this
     file or in a URL.
   ========================================================= */
window.AZENK_CONFIG = {
  BRAND: "AZENK",
  TAGLINE: "Digital · Technology · Creative",
  DOMAIN: "https://azenk.sa",
  FOUNDER: { ar: "عبدالعزيز الخالدي", en: "Abdulaziz AlKhaldi" },

  WHATSAPP_NUMBER: "966507192393",
  EMAIL: "azozazo88z@gmail.com",
  TIKTOK_URL: "",
  DEMO_CENTER_URL: "",

  DEFAULT_LANG: "ar",
};
