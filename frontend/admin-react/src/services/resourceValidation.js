const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateResourceField(field, value, values = {}) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  const trimmed = text.trim();
  if (field.required && !trimmed) return `${field.label} is required.`;
  if (!trimmed) return '';
  if (field.validation === 'mobile' && !MOBILE_PATTERN.test(text)) return 'Enter a 10-digit mobile number beginning with 6, 7, 8, or 9.';
  if (field.type === 'email' && !EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
  if (field.validation === 'date-of-birth') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return 'Enter a valid date.';
    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return 'Enter a valid date.';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (date > today) return 'Date of birth cannot be in the future.';
  }
  if (field.type === 'number') {
    const number = Number(text);
    if (!Number.isFinite(number)) return `${field.label} must be a valid number.`;
    if (number < 0) return `${field.label} cannot be negative.`;
    if (field.min != null && number < field.min) return `${field.label} must be at least ${field.min}.`;
    if (field.integer && !Number.isInteger(number)) return `${field.label} must be a whole number.`;
    if (field.decimalPlaces != null && Number(text) !== Number(number.toFixed(field.decimalPlaces))) return `${field.label} can have at most ${field.decimalPlaces} decimal places.`;
    if (field.maxDigits && number >= 10 ** (field.maxDigits - (field.decimalPlaces || 0))) return `${field.label} is too large.`;
  }
  if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) return 'Enter a valid time.';
  if (field.name === 'end_time' && values.start_time && text <= values.start_time) return 'End time must be later than start time.';
  if (field.maxLength && text.length > field.maxLength) return `${field.label} cannot exceed ${field.maxLength} characters.`;
  return '';
}

export function validateResource(fields, values) {
  return Object.fromEntries(fields.map((field) => [field.name, validateResourceField(field, values[field.name], values)]).filter(([, message]) => message));
}

export function normalizeResourceValues(fields, values) {
  const normalized = { ...values };
  fields.forEach((field) => { if (typeof normalized[field.name] === 'string' && field.type !== 'password') normalized[field.name] = normalized[field.name].trim(); });
  return normalized;
}
