export function Loading({label='Loading…'}) { return <div className="loading-state" role="status">{label}</div>; }
export function ErrorMessage({children}) { return children ? <div className="error-message" role="alert">{children}</div> : null; }
export function PageState({loading,error,empty,children}) { if(loading) return <Loading/>; if(error) return <ErrorMessage>{error}</ErrorMessage>; if(empty) return <div className="empty-state">{empty}</div>; return children; }
