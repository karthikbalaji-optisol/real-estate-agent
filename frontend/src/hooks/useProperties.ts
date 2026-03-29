import { useCallback, useEffect, useState } from 'react';
import { fetchProperties, fetchProperty } from '../api/propertyApi';
import type { PaginatedResponse, Property, PropertyFilters } from '../types/property';

export function usePropertyList(filters: PropertyFilters) {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchProperties(filters)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

export function usePropertyDetail(id: string) {
  const [data, setData] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProperty(id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}
