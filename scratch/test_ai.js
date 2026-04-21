

async function testAIChat() {
  const url = 'http://localhost:3000'; // Make sure the server is running
  const payload = {
    messages: [{ role: 'user', content: 'What is UHQR?' }],
    userId: 'test-user',
    role: 'patient'
  };

  try {
    const res = await fetch(`${url}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (res.ok && data.message) {
      console.log('SUCCESS: AI responded correctly.');
    } else {
      console.error('FAILURE: Unexpected response.');
    }
  } catch (err) {
    console.error('ERROR connecting to server:', err.message);
  }
}

testAIChat();
