export function clearReceptionistAuth(storage, clearApiSession) {
  storage.removeItem('receptionist_user');
  clearApiSession();
}
