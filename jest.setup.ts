import '@testing-library/jest-dom';

jest.mock('@sindresorhus/slugify', () => ({
  __esModule: true,
  default: (str: string) => str.toLowerCase().replace(/\s+/g, '-'),
}));

jest.mock('@/lib/hanko', () => ({
  __esModule: true,
  default: null,
}));

jest.mock('@teamhanko/passkeys-next-auth-provider', () => ({
  __esModule: true,
  PasskeyProvider: jest.fn(() => ({
    id: 'passkeys',
    name: 'Passkeys',
    type: 'credentials',
  })),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    signatureDocument: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    signatureRecipient: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    signatureField: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    signatureAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    userTeam: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    investor: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    fund: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    fundroomActivation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    fundAggregate: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    view: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    accreditationAck: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    dataroom: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    link: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    viewer: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    capitalCall: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    capitalCallResponse: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    distribution: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    brand: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    manualInvestment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lPDocument: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    lPDocumentReview: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    documentVersion: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organizationIntegrationCredential: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profileChangeRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    investmentTranche: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    onboardingFlow: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    investment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    investorNote: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    verificationToken: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    verificationCode: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    viewerSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    contact: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    contactNote: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    contactActivity: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    pendingContact: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    sequenceEnrollment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    esigUsageRecord: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    fundingRound: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    fundPricingTier: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    envelope: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    envelopeRecipient: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    ndaSigningRecord: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    contactVault: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    documentFiling: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    documentTemplate: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    orgProductModule: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    orgAddOn: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({
      signatureDocument: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      signatureRecipient: {
        update: jest.fn(),
      },
      signatureField: {
        updateMany: jest.fn(),
      },
      signatureAuditLog: {
        create: jest.fn(),
      },
    })),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn(),
  },
}));

jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// "next-auth/next" delegates to "next-auth" so that tests which mock
// getServerSession via "next-auth" also affect code that imports from
// "next-auth/next" (e.g., lib/auth/rbac.ts).
jest.mock('next-auth/next', () => {
  const nextAuth = jest.requireMock('next-auth');
  return { getServerSession: nextAuth.getServerSession };
});

// ---------------------------------------------------------------------------
// Global module-access mock — allows all modules by default.
// ---------------------------------------------------------------------------
jest.mock('@/lib/middleware/module-access', () => ({
  resolveOrgIdFromTeam: jest.fn().mockResolvedValue('org-1'),
  checkModuleAccess: jest.fn().mockResolvedValue(null),
  checkModuleLimit: jest.fn().mockResolvedValue(null),
  checkModuleLimitAuto: jest.fn().mockResolvedValue(null),
  withModuleAccess: jest.fn((module: string) => (handler: any) => handler),
  withModuleAccessApp: jest.fn((module: string) => (handler: any) => handler),
  withModuleLimit: jest.fn((module: string, limitType: string) => (handler: any) => handler),
  withModuleLimitAuto: jest.fn((module: string, limitType: string, countFn: any) => (handler: any) => handler),
}));

// ---------------------------------------------------------------------------
// Global rate-limiter mock — allows all requests by default.
// ---------------------------------------------------------------------------
jest.mock('@/lib/security/rate-limiter', () => ({
  createRateLimiter: jest.fn(() => ({ limit: jest.fn().mockResolvedValue({ success: true }) })),
  signatureRateLimiter: { limit: jest.fn().mockResolvedValue({ success: true }) },
  authRateLimiter: { limit: jest.fn().mockResolvedValue({ success: true }) },
  apiRateLimiter: { limit: jest.fn().mockResolvedValue({ success: true }) },
  strictRateLimiter: { limit: jest.fn().mockResolvedValue({ success: true }) },
  uploadRateLimiter: { limit: jest.fn().mockResolvedValue({ success: true }) },
  mfaVerifyRateLimiter: { limit: jest.fn().mockResolvedValue({ success: true }) },
  withRateLimit: jest.fn((limiter: any) => (handler: any) => handler),
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
  appRouterUploadRateLimit: jest.fn().mockResolvedValue(null),
  appRouterStrictRateLimit: jest.fn().mockResolvedValue(null),
  appRouterAuthRateLimit: jest.fn().mockResolvedValue(null),
  appRouterMfaRateLimit: jest.fn().mockResolvedValue(null),
  appRouterSignatureRateLimit: jest.fn().mockResolvedValue(null),
  resetRateLimit: jest.fn(),
}));

// Rate limiter mock uses a shared limit function so tests can override behavior.
// The function is attached to the mock module for test access via jest.requireMock.
const __mockRateLimitFn = jest.fn().mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: Date.now() + 60000 });
jest.mock('@/lib/redis', () => ({
  ratelimit: jest.fn(() => ({
    limit: __mockRateLimitFn,
  })),
  __mockRateLimitFn,
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('@/lib/files/get-file', () => ({
  getFile: jest.fn().mockResolvedValue('https://example.com/test.pdf'),
}));

jest.mock('@/lib/resend', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendOrgEmail: jest.fn().mockResolvedValue({ success: true }),
  isResendConfigured: jest.fn().mockReturnValue(true),
  resend: {
    emails: { send: jest.fn().mockResolvedValue({ id: 'test-email-id' }) },
    domains: {
      create: jest.fn(),
      verify: jest.fn(),
      get: jest.fn(),
      remove: jest.fn(),
    },
  },
}));

jest.mock('@/lib/webhook/triggers/signature-events', () => ({
  onRecipientSigned: jest.fn().mockResolvedValue(undefined),
  onDocumentCompleted: jest.fn().mockResolvedValue(undefined),
  onDocumentDeclined: jest.fn().mockResolvedValue(undefined),
  onDocumentViewed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/pages/api/teams/[teamId]/signature-documents/[documentId]/send', () => ({
  sendToNextSigners: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
    domains: {
      create: jest.fn().mockResolvedValue({ data: { id: 'dom_test123', status: 'pending', records: [] }, error: null }),
      verify: jest.fn().mockResolvedValue({ data: { status: 'verified' }, error: null }),
      get: jest.fn().mockResolvedValue({ data: { status: 'verified', records: [] }, error: null }),
      remove: jest.fn().mockResolvedValue({}),
    },
  })),
}));

jest.mock('@/lib/errorHandler', () => ({
  errorhandler: jest.fn((error: any, res: any) => {
    console.error('errorhandler:', error?.message || error);
    if (res && !res.writableEnded) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }),
}));

jest.mock('@/pages/api/auth/[...nextauth]', () => ({
  authOptions: {
    providers: [],
    session: { strategy: 'jwt' },
  },
}));

// Mock notion modules (ESM with deep ESM dependency chain: ofetch, p-map, notion-types, destr)
jest.mock('notion-client', () => ({
  __esModule: true,
  NotionAPI: jest.fn().mockImplementation(() => ({
    getPage: jest.fn().mockResolvedValue({}),
    getBlocks: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('@/lib/notion', () => ({
  __esModule: true,
  default: {
    getPage: jest.fn().mockResolvedValue({}),
    getBlocks: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('notion-utils', () => ({
  __esModule: true,
  parsePageId: jest.fn((id: string) => id),
  getBlockTitle: jest.fn(),
  getPageTitle: jest.fn(),
}));

// Mock mupdf (ESM + WASM + top-level await — not available in test env)
jest.mock('mupdf', () => ({
  __esModule: true,
  Document: { openDocument: jest.fn() },
}));

// Mock @vercel/edge-config (ESM, requires Vercel runtime)
jest.mock('@vercel/edge-config', () => ({
  __esModule: true,
  get: jest.fn().mockResolvedValue(null),
  getAll: jest.fn().mockResolvedValue({}),
  has: jest.fn().mockResolvedValue(false),
  createClient: jest.fn(),
}));

// Mock stripe (webhook constructor needs secret key)
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({ type: 'test', data: { object: {} } }),
    },
  })),
}));

process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:5000';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.PERSONA_API_KEY = 'test-persona-key';
process.env.PERSONA_TEMPLATE_ID = 'test-template-id';
process.env.SIGNATURE_VERIFICATION_SECRET = 'test-signature-verification-secret-key-32chars';
process.env.STORAGE_ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
