/**
 * Department of Water — Dispatch Booking System
 * Supabase Client Singleton
 *
 * Loaded after the Supabase UMD script and config.js.
 * Exposes a single shared client as `window.supabaseClient`.
 */
(function () {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    console.error(
      "Supabase library failed to load. Check your internet connection and the CDN <script> tag."
    );
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
})();

