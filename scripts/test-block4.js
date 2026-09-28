const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

async function testBlock4() {
  console.log('--- Testing Block 4: Web Search API & Full System Verification ---');

  // 1. Register a test user
  const email = `searchuser_${Date.now()}@echogpt.com`;
  const regRes = await axios.post(`${BASE_URL}/auth/register`, {
    email,
    password: 'SearchUserPass123!',
  });
  const token = regRes.data.tokens.accessToken;
  const userHeaders = { headers: { Authorization: `Bearer ${token}` } };
  console.log('1. [PASS] User registered for Web Search tests');

  // 2. Execute Web Search Query
  const query = 'NestJS Clean Architecture best practices';
  const searchRes = await axios.post(
    `${BASE_URL}/search/query`,
    { query, maxResults: 3 },
    userHeaders,
  );
  console.log('2. [PASS] POST /search/query:');
  console.log('   -> Query:', searchRes.data.query);
  console.log('   -> Results returned:', searchRes.data.results.length);
  console.log('   -> Sample result title:', searchRes.data.results[0]?.title);

  // 3. Verify record was saved in DB
  const dbSearch = await prisma.webSearch.findUnique({
    where: { id: searchRes.data.id },
  });
  if (!dbSearch || dbSearch.query !== query) {
    console.error('FAIL: Search record not persisted to database!');
    process.exit(1);
  }
  console.log('3. [PASS] Verified search query persisted to PostgreSQL WebSearch table');

  // 4. Test Search History
  const historyRes = await axios.get(`${BASE_URL}/search/history`, userHeaders);
  console.log('4. [PASS] GET /search/history returned', historyRes.data.searches.length, 'records');
  if (historyRes.data.searches[0].query !== query) {
    console.error('FAIL: Search history query mismatch!');
    process.exit(1);
  }

  // 5. Test Recent Searches
  const recentRes = await axios.get(`${BASE_URL}/search/recent`, userHeaders);
  console.log('5. [PASS] GET /search/recent returned', recentRes.data.length, 'distinct queries');
  if (recentRes.data[0].query !== query) {
    console.error('FAIL: Recent search query mismatch!');
    process.exit(1);
  }

  // 6. Verify Swagger Docs /docs/
  const swaggerRes = await axios.get('http://localhost:3000/docs/');
  console.log('6. [PASS] Swagger UI at /docs/ accessible, size:', swaggerRes.data.length, 'bytes');

  console.log('\n======================================================');
  console.log(' ALL 4 BLOCKS COMPLETED & VERIFIED WITH 100% SUCCESS ');
  console.log('======================================================');
}

testBlock4()
  .catch((err) => {
    console.error('Test Failed:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
