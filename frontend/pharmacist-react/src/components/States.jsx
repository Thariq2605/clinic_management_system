export function Loading({ label = 'Loading pharmacy data…' }) { return <div className="state" role="status">{label}</div>; }
export function ErrorState({ message, retry }) { return <div className="state error" role="alert"><strong>Could not load data</strong><p>{message}</p>{retry && <button className="button" onClick={retry}>Try again</button>}</div>; }
export function Empty({ children = 'No records found.' }) { return <div className="empty">{children}</div>; }
export function Badge({ children }) { return <span className={`badge ${String(children).toLowerCase().replaceAll(' ', '-')}`}>{children}</span>; }
