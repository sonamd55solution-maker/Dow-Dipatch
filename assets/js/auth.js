/**
 * Department of Water — Dispatch Booking System
 * Auth Helpers
 *
 * Shared session/role utilities used across every page.
 * Relies on window.supabaseClient (see supabaseClient.js).
 */

const DoWAuth = (function () {
  /** Get the current logged-in session, or null. */
  async function getSession() {
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) {
      console.error("Error getting session:", error.message);
      return null;
    }
    return data.session;
  }

  /** Get the current user's profile row (id, full_name, role, is_active). */
  async function getProfile() {
    const session = await getSession();
    if (!session) return null;

    const { data, error } = await window.supabaseClient
      .from("profiles")
      .select("id, full_name, email, role, is_active")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("Error loading profile:", error.message);
      return null;
    }
    return data;
  }

  /**
   * Require a logged-in session. Redirects to login if missing.
   * Call at the top of every protected page.
   * Returns the profile object on success.
   */
  async function requireAuth({ requireAdmin = false, redirectTo = "../login.html" } = {}) {
    const session = await getSession();
    if (!session) {
      window.location.href = redirectTo;
      return null;
    }

    const profile = await getProfile();
    if (!profile || !profile.is_active) {
      await window.supabaseClient.auth.signOut();
      window.location.href = redirectTo;
      return null;
    }

    if (requireAdmin && profile.role !== "admin") {
      // Staff trying to access an admin page — send them back to their dashboard.
      window.location.href = "/dashboard.html";
      return null;
    }

    return profile;
  }

  async function logout(redirectTo = "login.html") {
    await window.supabaseClient.auth.signOut();
    window.location.href = redirectTo;
  }

  return { getSession, getProfile, requireAuth, logout };
})();
