const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

async function testBlock3() {
  console.log('--- Testing Block 3: Chat Module (Vercel AI SDK, Quota & History) ---');

  // 1. Register a test user
  const email = `chatuser_${Date.now()}@echogpt.com`;
  const regRes = await axios.post(`${BASE_URL}/auth/register`, {
    email,
    password: 'ChatUser123!',
  });
  const token = regRes.data.tokens.accessToken;
  const userId = regRes.data.user.id;
  const userHeaders = { headers: { Authorization: `Bearer ${token}` } };
  console.log('1. [PASS] User registered with 50 request quota');

  // 2. Send initial message
  const prompt1 = 'Explain the difference between SQL and NoSQL in two bullet points.';
  const chat1 = await axios.post(
    `${BASE_URL}/chat/message`,
    { prompt: prompt1 },
    userHeaders,
  );
  console.log('2. [PASS] First message processed via Vercel AI SDK routing:');
  console.log('   -> Provider:', chat1.data.provider);
  console.log('   -> Response:', chat1.data.response.slice(0, 100) + '...');
  console.log('   -> Requests Count:', chat1.data.requestsCount, '/ Remaining:', chat1.data.remainingRequests);

  if (chat1.data.requestsCount !== 1) {
    console.error('FAIL: requestsCount did not increment to 1!');
    process.exit(1);
  }

  const convId = chat1.data.conversationId;

  // 3. Send follow-up message in the same conversation
  const prompt2 = 'Can you give one example of each?';
  const chat2 = await axios.post(
    `${BASE_URL}/chat/message`,
    {
      prompt: prompt2,
      conversationId: convId,
    },
    userHeaders,
  );
  console.log('3. [PASS] Follow-up message sent in same thread:');
  console.log('   -> Conversation ID:', chat2.data.conversationId);
  console.log('   -> Requests Count:', chat2.data.requestsCount, '/ Remaining:', chat2.data.remainingRequests);

  if (chat2.data.requestsCount !== 2) {
    console.error('FAIL: requestsCount did not increment to 2!');
    process.exit(1);
  }

  // 4. List conversations
  const listRes = await axios.get(`${BASE_URL}/chat/conversations`, userHeaders);
  console.log('4. [PASS] GET /chat/conversations returned', listRes.data.conversations.length, 'threads');
  if (listRes.data.conversations[0].id !== convId) {
    console.error('FAIL: Listed conversation ID mismatch!');
    process.exit(1);
  }

  // 5. Get full conversation history
  const historyRes = await axios.get(`${BASE_URL}/chat/conversations/${convId}`, userHeaders);
  console.log('5. [PASS] GET /chat/conversations/:id returned', historyRes.data.messages.length, 'messages');
  if (historyRes.data.messages.length !== 4) {
    console.error('FAIL: Expected 4 messages (2 USER + 2 ASSISTANT), found', historyRes.data.messages.length);
    process.exit(1);
  }

  // 6. Test 402 Payment Required quota enforcement
  await prisma.user.update({
    where: { id: userId },
    data: { requestsCount: 50 },
  });

  try {
    await axios.post(
      `${BASE_URL}/chat/message`,
      { prompt: 'Should fail due to quota limit' },
      userHeaders,
    );
    console.error('FAIL: Quota limit was NOT enforced! Expected 402');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 402) {
      console.log('6. [PASS] Quota limit strictly enforced with 402 Payment Required:');
      console.log('   -> Message:', err.response.data.message);
    } else {
      console.error('FAIL: Expected status 402, got', err.response?.status);
      process.exit(1);
    }
  }

  // 7. Delete conversation
  const delRes = await axios.delete(`${BASE_URL}/chat/conversations/${convId}`, userHeaders);
  console.log('7. [PASS] DELETE /chat/conversations/:id:', delRes.data.message);

  console.log('\n--- BLOCK 3 VERIFICATION 100% SUCCESSFUL ---');
}

testBlock3()
  .catch((err) => {
    console.error('Test Failed:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
