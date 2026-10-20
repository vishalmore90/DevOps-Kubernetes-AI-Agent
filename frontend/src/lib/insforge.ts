import { createClient } from '@insforge/sdk';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || 'https://xq2heej9.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || 'anon_6b42d6cdd8174b63eeb3e31d46d1e15830491c76d447e8006038db858dec4b3e';

export const insforge = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
});
