const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  
  // Use Text Generation Inference endpoint (works with all models)
  const MODEL_API = 'https://router.huggingface.co/models/microsoft/Phi-3-mini-4k-instruct';

  const COMPANY_KB = `You are DOMINAL AI, the official assistant for Dominal Group.

Company Information:
- Name: Dominal Group
- Founder: Yahya Mundewadi (creator of this AI)
- Industry: Information Technology
- Services: Custom software development, AI solutions, web/mobile apps, cloud services

You ONLY answer questions about Dominal Group. If asked about other topics, say: "I can only help with Dominal Group services."`;

  if (!HF_TOKEN) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'HF_TOKEN not configured' 
      })
    };
  }

  try {
    const { message, history } = JSON.parse(event.body);

    console.log('=== API Call ===');
    console.log('Model:', MODEL_API);
    console.log('Message:', message);

    // Build prompt
    let prompt = COMPANY_KB + '\n\n';
    
    // Add last 2 exchanges from history
    const recentHistory = (history || []).slice(-2);
    recentHistory.forEach(([userMsg, botMsg]) => {
      prompt += `User: ${userMsg}\nAssistant: ${botMsg}\n`;
    });
    
    prompt += `User: ${message}\nAssistant:`;

    // Call HuggingFace API
    const response = await fetch(MODEL_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false
        }
      })
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HF Error:', errorText);
      
      if (response.status === 503) {
        throw new Error('Model is loading. Please wait 20 seconds and try again.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit reached. Please wait a moment.');
      }
      
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data).substring(0, 200));

    // Parse response - handle different formats
    let reply;
    
    if (Array.isArray(data)) {
      // Format: [{ "generated_text": "..." }]
      reply = data[0]?.generated_text || data[0];
    } else if (data.generated_text) {
      // Format: { "generated_text": "..." }
      reply = data.generated_text;
    } else if (typeof data === 'string') {
      reply = data;
    } else {
      console.error('Unexpected format:', data);
      throw new Error('Unexpected response format from model');
    }

    // Clean reply
    reply = String(reply).trim();
    
    // Remove any repeated context
    if (reply.includes('User:')) {
      reply = reply.split('User:')[0].trim();
    }
    if (reply.includes('Assistant:')) {
      reply = reply.split('Assistant:')[0].trim();
    }

    console.log('Final reply:', reply);

    if (!reply || reply.length === 0) {
      throw new Error('Empty response from model');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: reply
      })
    };

  } catch (error) {
    console.error('=== ERROR ===');
    console.error(error.message);
    console.error(error.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
