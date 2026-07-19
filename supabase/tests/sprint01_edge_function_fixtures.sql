-- Sprint 1 Edge Function authorization test fixtures
-- Applied AFTER supabase/seed.sql to create additional test identities.

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token)
VALUES
  (
    '10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident.b@example.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '10000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'revoked@example.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '10000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'disabled@example.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '10000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'unrelated@example.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants (id, legal_name, display_name, slug, status)
VALUES ('11111111-1111-1111-1111-222222222222', 'Assoc Residencial B', 'Residencial B', 'residencial-b', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.properties (id, tenant_id, label, nickname, address_line1, city, state, unit_identifier, block_identifier, status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-222222222222',
  'Casa 100', 'Casa Bloco 1', 'Rua B, 100', 'Curitiba', 'PR', 'Casa 100', 'Bloco 1', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, user_id, full_name, preferred_name, avatar_url, status, locale, timezone)
VALUES
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', 'Bruno Resident B', 'Bruno', NULL, 'active', 'pt-BR', 'America/Sao_Paulo'),
  ('20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000022', 'Revoked User', 'Revoked', NULL, 'active', 'pt-BR', 'America/Sao_Paulo'),
  ('20000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000033', 'Disabled User', 'Disabled', NULL, 'disabled', 'pt-BR', 'America/Sao_Paulo'),
  ('20000000-0000-0000-0000-000000000044', '10000000-0000-0000-0000-000000000044', 'Unrelated User', 'Unrelated', NULL, 'active', 'pt-BR', 'America/Sao_Paulo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.residence_members (id, tenant_id, property_id, profile_id, role, status, is_primary, start_date)
VALUES
  ('60000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-222222222222',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000011',
   'resident', 'active', true, CURRENT_DATE - 30),
  ('60000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000022',
   'resident', 'revoked', false, CURRENT_DATE - 60),
  ('60000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000033',
   'resident', 'active', false, CURRENT_DATE - 30)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_members (id, tenant_id, profile_id, role, status)
VALUES
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-222222222222',
   '20000000-0000-0000-0000-000000000044', 'association_viewer', 'active')
ON CONFLICT (id) DO NOTHING;
