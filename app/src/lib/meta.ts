import { useEffect, useState } from 'react';
import { api } from './api';

export type Meta = {
  interests: string[];
  personality: { key: string; q: string; low: string; high: string }[];
  lifestyle: Record<string, { label: string; options: string[] }>;
  intents: string[]; genders: string[]; reportReasons: string[];
};

let cache: Meta | null = null;
export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(cache);
  useEffect(() => {
    if (cache) return;
    let t: ReturnType<typeof setTimeout>;
    const load = () => api<Meta>('/meta').then(m => { cache = m; setMeta(m); }).catch(() => { t = setTimeout(load, 3000); });
    load();
    return () => clearTimeout(t);
  }, []);
  return meta;
}

export const isEdit = (p: { edit?: string }) => p.edit === '1';
