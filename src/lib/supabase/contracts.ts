export interface ProfileRecordContract {
  id: string;
  user_id: string;
  full_name: string;
  preferred_name: string | null;
  avatar_url: string | null;
  status: 'active' | 'inactive' | 'under_review' | 'disabled';
  locale: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileContactContract {
  id: string;
  profile_id: string;
  contact_type: 'email' | 'phone' | 'whatsapp';
  normalized_value: string;
  display_value: string;
  verification_state: 'unverified' | 'pending' | 'verified' | 'invalid' | 'outdated';
  is_primary: boolean;
  is_whatsapp_capable: boolean;
  verification_sent_at: string | null;
  verified_at: string | null;
  invalidated_at: string | null;
  outdated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantSummaryContract {
  id: string;
  display_name: string;
  slug: string;
  role: string;
  membership_kind: 'staff' | 'residence';
}

export interface ResidenceSummaryContract {
  id: string;
  tenant_id: string;
  label: string;
  nickname: string | null;
  unit_identifier: string;
  block_identifier: string | null;
  role: string;
  is_primary: boolean;
}

export interface AuthContextContract {
  profile: ProfileRecordContract | null;
  availableTenants: TenantSummaryContract[];
  availableResidences: ResidenceSummaryContract[];
  activeTenant: TenantSummaryContract | null;
  activeResidence: ResidenceSummaryContract | null;
  platformRoles: string[];
  statusFlags: {
    hasProfile: boolean;
    hasTenant: boolean;
    hasResidence: boolean;
    isPlatformAdmin: boolean;
  };
}

export interface ErrorEnvelopeContract {
  data: null;
  error: {
    code:
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'VALIDATION_ERROR'
      | 'CONFLICT'
      | 'RATE_LIMITED'
      | 'TEMPORARY_UNAVAILABLE'
      | 'INTERNAL_ERROR';
    message: string;
    requestId: string;
  };
  meta: {
    requestId: string;
    generatedAt: string;
  };
}
