const keys = ['pharmacist_access_token', 'pharmacist_user', 'pharmacist_profile'];

export function clearPharmacistAuth(storage) {
  keys.forEach(key => storage.removeItem(key));
  // Older code accidentally stored the profile under "undefined". Remove it
  // only when it is identifiable as a Pharmacist profile.
  try {
    if (String(JSON.parse(storage.getItem('undefined') || 'null')?.role || '').toLowerCase() === 'pharmacist') storage.removeItem('undefined');
  } catch { /* Preserve unrelated or malformed storage. */ }
}
