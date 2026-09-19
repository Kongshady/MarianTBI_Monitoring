// Canonical password policy: the exact rules enforced in code by the
// signup forms (8+, lowercase letter, number). Firebase itself only
// requires 6+ characters, so this policy is the stricter project standard.
export function passwordChecks(password) {
  const value = password || "";
  return [
    { key: "length", label: "At least 8 characters", met: value.length >= 8 },
    { key: "lowercase", label: "One lowercase letter", met: /[a-z]/.test(value) },
    { key: "number", label: "One number", met: /[0-9]/.test(value) },
  ];
}

export function meetsPasswordPolicy(password) {
  return passwordChecks(password).every((check) => check.met);
}
