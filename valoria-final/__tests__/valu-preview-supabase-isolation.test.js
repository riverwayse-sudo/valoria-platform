import { getValoriaSupabaseConfig } from '../lib/valoria-supabase-runtime-config.js';

describe('Valoria Supabase runtime environment isolation', () => {
  const production = {
    VERCEL_ENV: 'production',
    SUPABASE_URL: 'https://prod-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'production-service-role',
  };

  test('production uses the production server credentials', () => {
    expect(getValoriaSupabaseConfig(production)).toEqual({
      url: 'https://prod-project.supabase.co',
      serviceRoleKey: 'production-service-role',
    });
  });

  test('Cloudflare Pages production branch uses production credentials', () => {
    expect(getValoriaSupabaseConfig({
      CF_PAGES: '1',
      CF_PAGES_BRANCH: 'main',
      SUPABASE_URL: 'https://prod-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'production-service-role',
    })).toEqual({
      url: 'https://prod-project.supabase.co',
      serviceRoleKey: 'production-service-role',
    });
  });

  test('Vercel preview refuses to fall back to production credentials', () => {
    expect(getValoriaSupabaseConfig({
      ...production,
      VERCEL_ENV: 'preview',
      VITE_SUPABASE_URL: 'https://prod-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'production-anon',
    })).toBeNull();
  });

  test('Cloudflare Pages preview branch refuses to fall back to production credentials', () => {
    expect(getValoriaSupabaseConfig({
      ...production,
      CF_PAGES: '1',
      CF_PAGES_BRANCH: 'fix/assessment-handoff-token-verification-v2',
      VITE_SUPABASE_URL: 'https://prod-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'production-anon',
    })).toBeNull();
  });

  test('preview accepts only a matching isolated public and server project', () => {
    expect(getValoriaSupabaseConfig({
      VERCEL_ENV: 'preview',
      VITE_SUPABASE_URL: 'https://preview-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'preview-anon',
      VALU_PREVIEW_SUPABASE_URL: 'https://preview-project.supabase.co/',
      VALU_PREVIEW_SUPABASE_ANON_KEY: 'preview-anon',
      VALU_PREVIEW_SUPABASE_SERVICE_ROLE_KEY: 'preview-service-role',
    })).toEqual({
      url: 'https://preview-project.supabase.co',
      serviceRoleKey: 'preview-service-role',
    });
  });

  test.each([
    { VITE_SUPABASE_URL: 'https://production.supabase.co' },
    { VALU_PREVIEW_SUPABASE_ANON_KEY: 'wrong-anon' },
    { VALU_PREVIEW_SUPABASE_SERVICE_ROLE_KEY: '' },
  ])('preview rejects mismatched or missing configuration: %j', overrides => {
    const base = {
      VERCEL_ENV: 'preview',
      VITE_SUPABASE_URL: 'https://preview-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'preview-anon',
      VALU_PREVIEW_SUPABASE_URL: 'https://preview-project.supabase.co',
      VALU_PREVIEW_SUPABASE_ANON_KEY: 'preview-anon',
      VALU_PREVIEW_SUPABASE_SERVICE_ROLE_KEY: 'preview-service-role',
    };
    expect(getValoriaSupabaseConfig({ ...base, ...overrides })).toBeNull();
  });
});
