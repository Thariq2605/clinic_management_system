import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  }, []);
  return <ToastContext.Provider value={notify}>{children}{toast && <div role="status" className={`toast toast-${toast.type}`}>{toast.message}<button onClick={() => setToast(null)} aria-label="Dismiss notification">×</button></div>}</ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
