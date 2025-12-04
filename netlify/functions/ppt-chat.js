const fetch = require('node-fetch');

exports.handler = async (event) => {
if (event.httpMethod !== 'POST') {
return {
statusCode: 405,
body: JSON.stringify({ error: 'Method not allowed' })
};
}

try {
const { messages, systemPrompt } = JSON.parse(event.body);

const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
method: 'POST',
headers: {
'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({
model: 'llama-3.1-8b-instant',
messages: [
{
role: 'system',
content: systemPrompt || 'You are a helpful AI assistant for creating presentations.'
},
...messages
],
temperature: 0.3,
max_tokens: 600,
stream: false
})

});

if (!response.ok) {
throw new Error(`Groq API error: ${response.statusText}`);
}

const data = await response.json();

return {
statusCode: 200,
headers: {
'Content-Type': 'application/json',
'Access-Control-Allow-Origin': '*'
},
body: JSON.stringify({
reply: data.choices[0].message.content
})
};

} catch (error) {
console.error('Error:', error);
return {
statusCode: 500,
headers: {
'Content-Type': 'application/json',
'Access-Control-Allow-Origin': '*'
},
body: JSON.stringify({
error: error.message || 'Failed to process request'
})
};
}
};
