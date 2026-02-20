
export function normalizeOptionalText(value: unknown, maxLength = 250): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

export function requireText(value: unknown, label: string, maxLength = 250): string {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) throw new Error(`${label} es obligatorio`);
  return normalized;
}

export function normalizeEmail(value: unknown): string | null {
  const email = normalizeOptionalText(value, 320);
  if (!email) return null;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) throw new Error("Email invalido");
  return email.toLowerCase();
}

export function normalizePhone(value: unknown): string | null {
  const phone = normalizeOptionalText(value, 32);
  if (!phone) return null;
  const valid = /^[+()\-\s\d]{6,32}$/.test(phone);
  if (!valid) throw new Error("Telefono invalido");
  return phone;
}

export function normalizeDateInput(value: unknown): string | null {
  const text = normalizeOptionalText(value, 32);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha invalida");
  return date.toISOString();
}
