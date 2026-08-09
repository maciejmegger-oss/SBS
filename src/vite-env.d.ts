/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Znacznik wersji podstawiany przez Vite przy budowaniu (patrz vite.config.ts).
declare const __WERSJA__: string;
