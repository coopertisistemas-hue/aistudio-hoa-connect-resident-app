-- Sprint 1 representative seed data

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'resident.a@example.com',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'operator.a@example.com',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'platform.admin@example.com',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants (id, legal_name, display_name, slug, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Associacao Jardim das Nascentes', 'Jardim das Nascentes', 'jardim-das-nascentes', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.properties (
  id,
  tenant_id,
  label,
  nickname,
  address_line1,
  city,
  state,
  unit_identifier,
  block_identifier,
  status
)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Apartamento 201',
    'Apto Bloco 3',
    'Rua das Nascentes, 500',
    'Curitiba',
    'PR',
    'Apto 201',
    'Bloco 3',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, user_id, full_name, preferred_name, avatar_url, status, locale, timezone)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Ana Resident A', 'Ana', NULL, 'active', 'pt-BR', 'America/Sao_Paulo'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Olivia Operator A', 'Olivia', NULL, 'active', 'pt-BR', 'America/Sao_Paulo'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Paula Platform Admin', 'Paula', NULL, 'active', 'pt-BR', 'America/Sao_Paulo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profile_contacts (
  id,
  profile_id,
  contact_type,
  normalized_value,
  display_value,
  verification_state,
  is_primary,
  is_whatsapp_capable,
  verified_at
)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'email', 'resident.a@example.com', 'resident.a@example.com', 'verified', true, false, now()),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'whatsapp', '+5541999991111', '(41) 99999-1111', 'verified', true, true, now()),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'email', 'operator.a@example.com', 'operator.a@example.com', 'verified', true, false, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.platform_role_assignments (id, profile_id, role, status)
VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'platform_admin', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_members (id, tenant_id, profile_id, role, status)
VALUES
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000002', 'association_operator', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.residence_members (id, tenant_id, property_id, profile_id, role, status, is_primary, start_date)
VALUES
  ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000001', 'owner', 'active', true, CURRENT_DATE - 30)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profile_preferences (profile_id, locale, timezone, accessibility, app_preferences)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'pt-BR', 'America/Sao_Paulo', '{"fontSize":"regular"}'::jsonb, '{"noticePush":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000002', 'pt-BR', 'America/Sao_Paulo', '{}'::jsonb, '{}'::jsonb),
  ('20000000-0000-0000-0000-000000000003', 'pt-BR', 'America/Sao_Paulo', '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (profile_id) DO NOTHING;

INSERT INTO public.profile_devices (id, profile_id, device_name, device_platform, app_version)
VALUES
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'iPhone de Ana', 'ios', '1.0.0')
ON CONFLICT (id) DO NOTHING;
