export function normalizeAuthEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateAuthEmail(value: string) {
  const normalizedEmail = normalizeAuthEmail(value);

  if (!normalizedEmail) {
    return "Enter your email address.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validatePasswordForAuth(value: string) {
  if (value.length < 8) {
    return "Use at least 8 characters for the password.";
  }

  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Use at least one letter and one number in the password.";
  }

  return null;
}

export function getFriendlyAuthErrorMessage(action: "signIn" | "signUp" | "reset" | "updatePassword", message: string | null | undefined) {
  const normalizedMessage = (message ?? "").trim().toLowerCase();

  if (!normalizedMessage) {
    return action === "reset"
      ? "Could not process the password reset request."
      : action === "updatePassword"
        ? "Could not update the password."
        : "Could not complete the authentication request.";
  }

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "An account with that email already exists. Try signing in instead.";
  }

  if (normalizedMessage.includes("password should")) {
    return "Password does not meet the required format yet.";
  }

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("too many requests")) {
    return "Too many attempts right now. Please wait a moment and try again.";
  }

  if (normalizedMessage.includes("same password")) {
    return "Choose a different password from the one currently on the account.";
  }

  if (normalizedMessage.includes("session") && action === "updatePassword") {
    return "The password reset session is no longer valid. Request a new reset email and try again.";
  }

  return message ?? "Could not complete the authentication request.";
}
