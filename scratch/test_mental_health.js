
async function testMentalHealthChat() {
  const url = 'http://localhost:3000'; 
  const payload = {
    messages: [{ role: 'user', content: 'I am feeling very stressed lately with my work. Can you help?' }]
  };

  try {
    console.log('Testing Mental Health Chat...');
    const res = await fetch(`${url}/api/mental-health/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (res.ok && data.message) {
      console.log('SUCCESS: Mental Health AI responded correctly.');
    } else {
      console.error('FAILURE: Unexpected response.');
    }
  } catch (err) {
    console.error('ERROR connecting to server:', err.message);
  }
}

testMentalHealthChat();
