require('dotenv').config();
const { PrismaClient, AiModel } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function encryptApiKey(apiKey) {
  const rawKey = process.env.ENCRYPTION_KEY || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const key =
    rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)
      ? Buffer.from(rawKey, 'hex')
      : crypto.createHash('sha256').update(rawKey).digest();

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(apiKey, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

async function main() {
  console.log('--- Syncing Providers from .env into PostgreSQL ---');

  const openaiKey = process.env.Openai_Api || process.env.OPENAI_API_KEY;
  const geminiKey = process.env.Gemini_Api || process.env.GEMINI_API_KEY;

  if (openaiKey) {
    const encryptedOpenAI = encryptApiKey(openaiKey);
    await prisma.provider.upsert({
      where: { name: AiModel.OPENAI },
      update: {
        apiKey: encryptedOpenAI,
        isActive: true,
      },
      create: {
        name: AiModel.OPENAI,
        apiKey: encryptedOpenAI,
        isDefault: true,
        isActive: true,
      },
    });
    console.log('[Sync] Updated OPENAI provider with AES-256-GCM encrypted key from .env');
  }

  if (geminiKey) {
    const encryptedGemini = encryptApiKey(geminiKey);
    await prisma.provider.upsert({
      where: { name: AiModel.GEMINI },
      update: {
        apiKey: encryptedGemini,
        isActive: true,
      },
      create: {
        name: AiModel.GEMINI,
        apiKey: encryptedGemini,
        isDefault: false,
        isActive: true,
      },
    });
    console.log('[Sync] Updated GEMINI provider with AES-256-GCM encrypted key from .env');
  }

  console.log('--- Done syncing providers ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
