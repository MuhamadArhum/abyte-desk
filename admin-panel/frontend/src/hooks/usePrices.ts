import { useEffect, useState } from 'react';
import api from '../api/axios';

export interface ModulePrices { sales: number; inventory: number; accounts: number; hr: number; }

const DEFAULT: ModulePrices = { sales: 2250, inventory: 2250, accounts: 2999, hr: 2999 };

export function usePrices() {
  const [prices, setPrices] = useState<ModulePrices>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    api.get('/settings/prices')
      .then(r => { setPrices({ ...DEFAULT, ...r.data.prices }); })
      .catch(() => { setError(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return { prices, loading, error, reload: load };
}
