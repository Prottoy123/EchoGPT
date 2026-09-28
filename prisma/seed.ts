import { PrismaClient, Role, PlanType, AiModel } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function encryptApiKey(apiKey: string): string {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  const key = rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)
    ? Buffer.from(rawKey, 'hex')
    : crypto.createHash('sha256').update(rawKey).digest();

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(apiKey, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Pack iv:authTag:ciphertext into a single compact string
  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

async function main() {
  console.log('--- EchoGPT Lean DB Seeding ---');

  // 1. Seed Subscriptions
  let freePlan = await prisma.subscription.findFirst({
    where: { planName: PlanType.FREE },
  });
  if (!freePlan) {
    freePlan = await prisma.subscription.create({
      data: {
        planName: PlanType.FREE,
        requestLimit: 50,
      },
    });
    console.log('[Seed] Created FREE plan (50 requests limit)');
  }

  let premiumPlan = await prisma.subscription.findFirst({
    where: { planName: PlanType.PREMIUM },
  });
  if (!premiumPlan) {
    premiumPlan = await prisma.subscription.create({
      data: {
        planName: PlanType.PREMIUM,
        requestLimit: 1000,
      },
    });
    console.log('[Seed] Created PREMIUM plan (1000 requests limit)');
  }

  // 2. Seed Admin User
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
  }
  const hashedPassword = await argon2.hash(adminPassword);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: Role.ADMIN,
        subscriptionId: premiumPlan.id,
      },
    });
    console.log(`[Seed] Created Admin User: ${adminEmail}`);
  }

  // 3. Seed AI Providers
  const providers = [
    {
      name: AiModel.OPENAI,
      rawKey: process.env.OPENAI_API_KEY || process.env.Openai_Api || 'sk-demo-openai-key',
      isDefault: true,
    },
    {
      name: AiModel.GEMINI,
      rawKey: process.env.GEMINI_API_KEY || process.env.Gemini_Api || 'AIzaSyDemoGeminiKey',
      isDefault: false,
    },
    {
      name: AiModel.CLAUDE,
      rawKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-demo-claude-key',
      isDefault: false,
    },
  ];

  for (const prov of providers) {
    const existing = await prisma.provider.findUnique({
      where: { name: prov.name },
    });
    if (!existing) {
      await prisma.provider.create({
        data: {
          name: prov.name,
          apiKey: encryptApiKey(prov.rawKey),
          isActive: true,
          isDefault: prov.isDefault,
        },
      });
      console.log(`[Seed] Created Provider: ${prov.name}`);
    }
  }

  console.log('--- Seeding Completed ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
