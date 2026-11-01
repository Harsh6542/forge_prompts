export interface ServicePortalDef {
  serviceType: string;
  portalName: string;
  portalUrl: string;
  refPrefix: string;
  // 'year' → NSP-2026-XXXXXX · 'demo' → PAN-DEMO-XXXXXX
  refStyle: 'year' | 'demo';
  captchaConfigured: boolean;
}

export const SERVICE_PORTALS: Record<string, ServicePortalDef> = {
  scholarship: {
    serviceType: 'scholarship',
    portalName: 'National Scholarship Portal',
    portalUrl: 'https://scholarships.gov.in',
    refPrefix: 'NSP',
    refStyle: 'year',
    captchaConfigured: true,
  },
  pan_card: {
    serviceType: 'pan_card',
    portalName: 'NSDL PAN Services',
    portalUrl: 'https://onlineservices.nsdl.com',
    refPrefix: 'PAN',
    refStyle: 'demo',
    captchaConfigured: true,
  },
  passport: {
    serviceType: 'passport',
    portalName: 'Passport Seva',
    portalUrl: 'https://passportindia.gov.in',
    refPrefix: 'PASS',
    refStyle: 'year',
    captchaConfigured: true,
  },
  ration_card: {
    serviceType: 'ration_card',
    portalName: 'National Food Security Authority',
    portalUrl: 'https://nfsa.gov.in',
    refPrefix: 'RC',
    refStyle: 'demo',
    captchaConfigured: false,
  },
  driving_license: {
    serviceType: 'driving_license',
    portalName: 'Sarathi Parivahan',
    portalUrl: 'https://sarathi.parivahan.gov.in',
    refPrefix: 'DL',
    refStyle: 'year',
    captchaConfigured: true,
  },
  income_certificate: {
    serviceType: 'income_certificate',
    portalName: 'State e-District Portal',
    portalUrl: 'https://digitalservices.gov.in',
    refPrefix: 'IC',
    refStyle: 'demo',
    captchaConfigured: false,
  },
};

// Order matters — form fields are filled in this sequence per service
export const FILL_FIELD_ORDER: Record<string, string[]> = {
  scholarship: ['fullName', 'dob', 'mobile', 'email', 'aadhaar', 'state', 'bankAccount'],
  pan_card: ['fullName', 'guardianName', 'dob', 'mobile', 'email', 'aadhaar'],
  passport: ['fullName', 'dob', 'email', 'mobile', 'address'],
  ration_card: ['fullName', 'mobile', 'familySize', 'incomeAnnual', 'address', 'state'],
  driving_license: ['fullName', 'dob', 'bloodGroup', 'mobile', 'address'],
  income_certificate: ['fullName', 'incomeAnnual', 'mobile', 'address', 'state'],
};

export const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full Name',
  guardianName: "Father's / Mother's Name",
  dob: 'Date of Birth',
  mobile: 'Mobile Number',
  email: 'Email Address',
  aadhaar: 'Aadhaar Number',
  address: 'Residential Address',
  state: 'State',
  incomeAnnual: 'Annual Family Income',
  familySize: 'Family Members Count',
  bankAccount: 'Bank Account Number',
  bloodGroup: 'Blood Group',
};

// Values shown to the citizen in step events — sensitive digits are masked
export const MASKED_FIELDS = new Set(['aadhaar', 'bankAccount']);
