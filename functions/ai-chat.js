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
  
  // Choose one of these models:
  const MODEL_API = 'https://router.huggingface.co/google/gemma-2-2b-it';

 
  // https://router.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct';
  // OR: 'https://router.huggingface.co/models/microsoft/Phi-3-mini-4k-instruct'
  // OR: 'https://router.huggingface.co/models/google/gemma-2-2b-it'

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

    console.log('Using model:', MODEL_API);
    console.log('Message:', message);

    // Build conversation context
    let conversationContext = COMPANY_KB + '\n\n';
    
    // Add history (last 3 exchanges only to keep it fast)
    const recentHistory = (history || []).slice(-3);
    recentHistory.forEach(([userMsg, botMsg]) => {
      conversationContext += `User: ${userMsg}\nAssistant: ${botMsg}\n`;
    });
    
    conversationContext += `User: ${message}\nAssistant:`;

    // Call HuggingFace Inference API
    const response = await fetch(MODEL_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: conversationContext,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.7,
          top_p: 0.9,
          return_full_text: false
        },
        options: {
          use_cache: false,
          wait_for_model: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HF API Error:', response.status, errorText);
      
      // Handle rate limit
      if (response.status === 429) {
        throw new Error('Rate limit reached. Please wait a moment and try again.');
      }
      
      throw new Error(`Model API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Raw response:', JSON.stringify(data));

    // Extract reply from different possible response formats
    let reply;
    if (Array.isArray(data) && data[0]?.generated_text) {
      reply = data[0].generated_text;
    } else if (data.generated_text) {
      reply = data.generated_text;
    } else if (typeof data === 'string') {
      reply = data;
    } else {
      console.error('Unexpected response format:', data);
      throw new Error('Could not parse model response');
    }

    // Clean up reply
    reply = reply.trim();
    
    // Remove any repeated prompts
    if (reply.includes('User:') || reply.includes('Assistant:')) {
      reply = reply.split('User:')[0].split('Assistant:')[0].trim();
    }

    console.log('Final reply:', reply);

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
    console.error('Function Error:', error.message);
    
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
