-- Sprint 1 Performance Seed — Representative data volumes
-- Run AFTER supabase/seed.sql in a non-production disposable stack.

DO $$
DECLARE
  tenant_idx integer;
  prop_idx integer;
  profile_idx integer;
  tid uuid;
  pid uuid;
  uid uuid;
  prof_id uuid;
  start_ts timestamptz := clock_timestamp();
  base_tenant uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  RAISE NOTICE 'Seeding performance data (50 tenants, ~500 properties, ~3000 profiles)...';

  -- Create tenant rows 2..50
  FOR tenant_idx IN 2..50 LOOP
    tid := ('99999999-8888-4444-aaaa-' || LPAD(tenant_idx::text, 12, '0'))::uuid;
    INSERT INTO public.tenants (id, legal_name, display_name, slug, status)
    VALUES (tid, 'Assoc T' || tenant_idx, 'Tenant ' || tenant_idx, 't-' || tenant_idx, 'active');
  END LOOP;

  -- Create properties: 10 per tenant
  FOR tenant_idx IN 1..50 LOOP
    tid := CASE WHEN tenant_idx = 1 THEN base_tenant
           ELSE ('99999999-8888-4444-aaaa-' || LPAD(tenant_idx::text, 12, '0'))::uuid END;
    FOR prop_idx IN 1..10 LOOP
      INSERT INTO public.properties (id, tenant_id, label, address_line1, city, state, unit_identifier, status)
      VALUES (gen_random_uuid(), tid, 'U' || tenant_idx || '-' || prop_idx, 'Addr ' || tenant_idx, 'Curitiba', 'PR', 'U-' || prop_idx,
        CASE WHEN prop_idx <= 9 THEN 'active'::public.property_status ELSE 'inactive'::public.property_status END);
    END LOOP;
  END LOOP;

  -- Create profiles: 60 per tenant (but only for tenant 1 we already have 3 existing)
  FOR tenant_idx IN 1..50 LOOP
    tid := CASE WHEN tenant_idx = 1 THEN base_tenant
           ELSE ('99999999-8888-4444-aaaa-' || LPAD(tenant_idx::text, 12, '0'))::uuid END;
    FOR profile_idx IN 1..60 LOOP
      uid := gen_random_uuid();
      prof_id := gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, created_at, updated_at)
      VALUES (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'p-' || tenant_idx || '-' || profile_idx || '@test.com',
        crypt('Password123!', gen_salt('bf')), now(),
        '{"provider":"email"}'::jsonb, now(), now());
      INSERT INTO public.profiles (id, user_id, full_name, status, locale, timezone)
      VALUES (prof_id, uid, 'P' || tenant_idx || '-' || profile_idx,
        CASE WHEN profile_idx <= 54 THEN 'active'::public.profile_status
             WHEN profile_idx <= 57 THEN 'inactive'::public.profile_status
             ELSE 'disabled'::public.profile_status END,
        'pt-BR', 'America/Sao_Paulo');
    END LOOP;
  END LOOP;

  -- Create tenant memberships: 5 staff per tenant
  FOR tenant_idx IN 1..50 LOOP
    tid := CASE WHEN tenant_idx = 1 THEN base_tenant
           ELSE ('99999999-8888-4444-aaaa-' || LPAD(tenant_idx::text, 12, '0'))::uuid END;
    FOR profile_idx IN 1..5 LOOP
      uid := gen_random_uuid();
      prof_id := gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, created_at, updated_at)
      VALUES (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'staff-' || tenant_idx || '-' || profile_idx || '@test.com',
        crypt('Password123!', gen_salt('bf')), now(),
        '{"provider":"email"}'::jsonb, now(), now());
      INSERT INTO public.profiles (id, user_id, full_name, status, locale, timezone)
      VALUES (prof_id, uid, 'Staff-' || tenant_idx || '-' || profile_idx, 'active'::public.profile_status, 'pt-BR', 'America/Sao_Paulo');
      INSERT INTO public.tenant_members (id, tenant_id, profile_id, role, status)
      VALUES (gen_random_uuid(), tid, prof_id,
        CASE profile_idx
          WHEN 1 THEN 'association_admin'::public.tenant_role
          WHEN 2 THEN 'association_operator'::public.tenant_role
          ELSE 'association_viewer'::public.tenant_role
        END,
        'active'::public.tenant_membership_status);
    END LOOP;
  END LOOP;

  -- Create residence memberships: assign first 54 profiles per tenant to properties
  FOR tenant_idx IN 1..50 LOOP
    tid := CASE WHEN tenant_idx = 1 THEN base_tenant
           ELSE ('99999999-8888-4444-aaaa-' || LPAD(tenant_idx::text, 12, '0'))::uuid END;
    FOR prop_idx IN 1..10 LOOP
      pid := NULL;
      SELECT id INTO pid FROM public.properties WHERE tenant_id = tid AND unit_identifier = 'U-' || prop_idx LIMIT 1;
      IF pid IS NULL THEN CONTINUE; END IF;
      -- Assign 5 active residents + 1 revoked per property
      FOR profile_idx IN 1..6 LOOP
        SELECT id INTO prof_id FROM public.profiles WHERE full_name = 'P' || tenant_idx || '-' || ((prop_idx-1)*6 + profile_idx) LIMIT 1;
        IF prof_id IS NULL THEN CONTINUE; END IF;
        INSERT INTO public.residence_members (id, tenant_id, property_id, profile_id, role, status, is_primary, start_date)
        VALUES (gen_random_uuid(), tid, pid, prof_id,
          CASE profile_idx WHEN 1 THEN 'owner'::public.residence_role ELSE 'resident'::public.residence_role END,
          CASE WHEN profile_idx <= 5 THEN 'active'::public.residence_membership_status ELSE 'revoked'::public.residence_membership_status END,
          profile_idx = 1, CURRENT_DATE - (30 * profile_idx));
      END LOOP;
    END LOOP;
  END LOOP;

  -- Create profile contacts: 3 contacts per active profile (none primary to avoid constraint conflict)
  INSERT INTO public.profile_contacts (id, profile_id, contact_type, normalized_value, display_value, verification_state, is_primary, verified_at)
  SELECT gen_random_uuid(), p.id, ct.t::public.contact_type,
    lower('c-' || replace(p.full_name, ' ', '-') || '-' || ct.t || '@test.com'),
    p.full_name || '-' || ct.t,
    CASE WHEN ct.t = 'email' THEN 'verified'::public.verification_state ELSE 'unverified'::public.verification_state END,
    false,
    CASE WHEN ct.t = 'email' THEN now() ELSE NULL END
  FROM public.profiles AS p
  CROSS JOIN (VALUES ('email'), ('phone'), ('whatsapp')) AS ct(t)
  WHERE p.status = 'active'::public.profile_status
    AND p.id NOT IN (SELECT profile_id FROM public.profile_contacts WHERE profile_id = p.id AND contact_type = ct.t::public.contact_type AND deleted_at IS NULL);

  -- Create audit events: 200 per tenant (~10000 total)
  FOR tenant_idx IN 1..50 LOOP
    tid := CASE WHEN tenant_idx = 1 THEN base_tenant
           ELSE ('99999999-8888-4444-aaaa-' || LPAD(tenant_idx::text, 12, '0'))::uuid END;
    INSERT INTO public.audit_events (id, tenant_id, actor_user_id, actor_profile_id, action, entity_type, entity_id, request_id, source, metadata, created_at)
    SELECT gen_random_uuid(), tid,
      '10000000-0000-0000-0000-000000000001'::uuid,
      '20000000-0000-0000-0000-000000000001'::uuid,
      CASE (rn % 5)
        WHEN 0 THEN 'profile.update.self' WHEN 1 THEN 'contact.upsert'
        WHEN 2 THEN 'tenant.select' WHEN 3 THEN 'auth.bootstrap' ELSE 'audit.read'
      END,
      CASE (rn % 3) WHEN 0 THEN 'profile' WHEN 1 THEN 'contact' ELSE 'tenant' END,
      gen_random_uuid(), gen_random_uuid()::text, 'seed',
      '{}'::jsonb,
      now() - (rn || ' days')::interval
    FROM generate_series(1, 200) AS rn;
  END LOOP;

  RAISE NOTICE 'Performance seed completed in %s s', EXTRACT(EPOCH FROM (clock_timestamp() - start_ts));
END $$;

ANALYZE;
