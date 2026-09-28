import { PrismaClient, Role, PlanTier, SubscriptionStatus, AIProviderType, ProviderHealth } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function encryptApiKey(apiKey: string): { ciphertext: string; iv: string; authTag: string } {
  const rawKey = process.env.ENCRYPTION_KEY || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const key = rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)
    ? Buffer.from(rawKey, 'hex')
    : crypto.createHash('sha256').update(rawKey).digest();

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(apiKey, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return { ciphertext, iv: iv.toString('hex'), authTag };
}

async function main() {
  console.log('--- EchoGPT Database Seeding Started ---');

  // 1. Seed Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@echogpt.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const hashedPassword = await argon2.hash(adminPassword);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  let adminUser = existingAdmin;
  if (!existingAdmin) {
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        firstName: 'System',
        lastName: 'Admin',
        role: Role.ADMIN,
        isEmailVerified: true,
      },
    });
    console.log(`[Seed] Created Admin User: ${adminEmail}`);
  } else {
    console.log(`[Seed] Admin user already exists: ${adminEmail}`);
  }

  // 2. Seed Admin Subscription (Enterprise tier)
  if (adminUser) {
    const existingSub = await prisma.subscription.findUnique({
      where: { userId: adminUser.id },
    });

    if (!existingSub) {
      const now = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(now.getFullYear() + 1);

      await prisma.subscription.create({
        data: {
          userId: adminUser.id,
          plan: PlanTier.ENTERPRISE,
          status: SubscriptionStatus.ACTIVE,
          monthlyRequestLimit: 999999,
          monthlyTokenLimit: 10000000,
          currentPeriodStart: now,
          currentPeriodEnd: nextYear,
        },
      });
      console.log(`[Seed] Created Enterprise Subscription for Admin`);
    }
  }

  // 3. Seed AI Providers
  const defaultProviders = [
    {
      providerType: AIProviderType.OPENAI,
      displayName: 'OpenAI',
      rawKey: process.env.OPENAI_API_KEY || 'sk-demo-openai-key-echogpt-default',
      baseUrl: 'https://api.openai.com/v1',
      defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      isEnabled: true,
      isDefault: true,
    },
    {
      providerType: AIProviderType.ANTHROPIC,
      displayName: 'Anthropic Claude',
      rawKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-demo-claude-key-echogpt-default',
      baseUrl: 'https://api.anthropic.com/v1',
      defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
      isEnabled: true,
      isDefault: false,
    },
    {
      providerType: AIProviderType.GEMINI,
      displayName: 'Google Gemini',
      rawKey: process.env.GEMINI_API_KEY || 'AIzaSyDemoGeminiKeyEchoGPTDefault',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
      isEnabled: true,
      isDefault: false,
    },
  ];

  for (const prov of defaultProviders) {
    const existing = await prisma.aIProvider.findFirst({
      where: { providerType: prov.providerType },
    });

    if (!existing) {
      const encrypted = encryptApiKey(prov.rawKey);
      await prisma.aIProvider.create({
        data: {
          providerType: prov.providerType,
          displayName: prov.displayName,
          encryptedApiKey: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          baseUrl: prov.baseUrl,
          defaultModels: prov.defaultModels,
          isEnabled: prov.isEnabled,
          isDefault: prov.isDefault,
          healthStatus: ProviderHealth.ONLINE,
          lastHealthCheck: new Date(),
        },
      });
      console.log(`[Seed] Seeded AI Provider: ${prov.displayName}`);
    } else {
      console.log(`[Seed] AI Provider already exists: ${prov.displayName}`);
    }
  }

  console.log('--- EchoGPT Database Seeding Finished Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
