const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

function decryptPacked(packed) {
  const [ivHex, authTagHex, ciphertextHex] = packed.split(':');
  const rawKey = process.env.ENCRYPTION_KEY || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const key = rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)
    ? Buffer.from(rawKey, 'hex')
    : crypto.createHash('sha256').update(rawKey).digest();

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let dec = decipher.update(ciphertextHex, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

async function testBlock2() {
  console.log('--- Testing Block 2: AI Provider Module (Admin CRUD & AES-256-GCM) ---');

  // 1. Login regular user
  const userReg = await axios.post(`${BASE_URL}/auth/register`, {
    email: `regular_${Date.now()}@echogpt.com`,
    password: 'UserPass123!',
  });
  const userToken = userReg.data.tokens.accessToken;

  // 2. Regular user trying to access admin endpoint -> must be 403
  try {
    await axios.get(`${BASE_URL}/ai-providers`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    console.error('FAIL: Regular user was able to access /ai-providers!');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('1. [PASS] RBAC Enforced: Regular user blocked with 403 Forbidden');
    } else {
      console.error('FAIL: Expected 403, got', err.response?.status);
      process.exit(1);
    }
  }

  // 3. Login as Admin
  const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'admin@echogpt.com',
    password: 'AdminPass123!',
  });
  const adminToken = adminLogin.data.tokens.accessToken;
  const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
  console.log('2. [PASS] Admin Authenticated successfully');

  // 4. List providers
  const listRes = await axios.get(`${BASE_URL}/ai-providers`, adminHeaders);
  console.log(`3. [PASS] Admin list providers returned ${listRes.data.length} providers`);
  for (const prov of listRes.data) {
    if (prov.apiKey) {
      console.error('FAIL: Provider apiKey field was leaked in response!');
      process.exit(1);
    }
  }
  console.log('   -> Verified zero plain-text or cipher keys exposed in GET responses');

  // 5. Add / Update provider with AES-256-GCM encryption
  const plainApiKey = 'sk-ant-live-real-secret-key-12345';
  const createRes = await axios.post(
    `${BASE_URL}/ai-providers`,
    {
      name: 'CLAUDE',
      apiKey: plainApiKey,
      isDefault: false,
    },
    adminHeaders,
  );
  console.log('4. [PASS] Provider registered via POST /ai-providers');

  // 6. Verify directly in database that apiKey is AES-256-GCM encrypted
  const dbRecord = await prisma.provider.findUnique({
    where: { name: 'CLAUDE' },
  });
  if (dbRecord.apiKey === plainApiKey) {
    console.error('FAIL: API Key was stored in plain text in the database!');
    process.exit(1);
  }
  const parts = dbRecord.apiKey.split(':');
  if (parts.length !== 3) {
    console.error('FAIL: Stored key does not match iv:authTag:ciphertext format!');
    process.exit(1);
  }
  const decrypted = decryptPacked(dbRecord.apiKey);
  if (decrypted !== plainApiKey) {
    console.error('FAIL: Decrypted key does not match original plain text key!');
    process.exit(1);
  }
  console.log('5. [PASS] Verified in DB: Key stored as AES-256-GCM (iv:authTag:ciphertext)');
  console.log('   -> Decrypted successfully in memory to original plaintext:', decrypted);

  // 7. Set default provider
  const claudeId = createRes.data.provider.id;
  const defRes = await axios.patch(
    `${BASE_URL}/ai-providers/${claudeId}/default`,
    {},
    adminHeaders,
  );
  console.log('6. [PASS] Set default provider (PATCH /:id/default):', defRes.data.message);

  // Verify other providers have isDefault = false
  const allProviders = await prisma.provider.findMany();
  const defaultCount = allProviders.filter((p) => p.isDefault).length;
  if (defaultCount !== 1) {
    console.error('FAIL: Expected exactly 1 default provider, found', defaultCount);
    process.exit(1);
  }
  console.log('7. [PASS] Verified exactly 1 global default provider exists');

  console.log('\n--- BLOCK 2 VERIFICATION 100% SUCCESSFUL ---');
}

testBlock2()
  .catch((err) => {
    console.error('Test Failed:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
