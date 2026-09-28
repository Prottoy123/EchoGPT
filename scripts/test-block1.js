const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

async function testBlock1() {
  console.log('--- Testing Block 1: App, Prisma, Auth & Users ---');

  // 1. Swagger UI check
  const swaggerRes = await axios.get('http://localhost:3000/docs/');
  console.log('1. Swagger UI check: status', swaggerRes.status, 'HTML length:', swaggerRes.data.length);

  // 2. Register user
  const email = `test_${Date.now()}@echogpt.com`;
  const regRes = await axios.post(`${BASE_URL}/auth/register`, {
    email,
    password: 'Password123!',
  });
  console.log('2. User Register: status', regRes.status, 'User email:', regRes.data.user.email, 'Plan:', regRes.data.user.subscription.planName);

  // 3. Login
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email,
    password: 'Password123!',
  });
  console.log('3. User Login: status', loginRes.status, 'Access token issued:', !!loginRes.data.tokens.accessToken);

  // 4. Token Refresh
  const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {
    refreshToken: loginRes.data.tokens.refreshToken,
  });
  console.log('4. Token Rotation (Refresh): status', refreshRes.status, 'New Access token:', !!refreshRes.data.accessToken);

  // 5. User Profile with remaining requests
  const profileRes = await axios.get(`${BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${refreshRes.data.accessToken}` },
  });
  console.log('5. Profile (/users/me):', JSON.stringify(profileRes.data));

  console.log('\n--- BLOCK 1 VERIFICATION 100% SUCCESSFUL ---');
}

testBlock1().catch(err => {
  console.error('Test Failed:', err.response?.data || err.message);
  process.exit(1);
});
