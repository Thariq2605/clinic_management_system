import { useCallback, useEffect, useState } from 'react';

export function useRequest(request, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await request()); }
    catch (err) { setError(err.message || 'Unable to load data.'); }
    finally { setLoading(false); }
  // The caller passes dependencies for the selected resource/filter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, loading, error, reload };
}
