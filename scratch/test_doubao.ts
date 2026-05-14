async function test() {
  const apiKey = "ark-4616b8fb-4a03-4b0e-bfe4-3bb07019ba72-a64c5";
  const endpointId = "doubao-seed-2-0-lite-260428";
  
  const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: endpointId,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ],
      temperature: 0.7,
    }),
  });

  console.log("Status:", response.status);
  const data = await response.json();
  console.log("Data:", JSON.stringify(data, null, 2));
}

test().catch(console.error);
