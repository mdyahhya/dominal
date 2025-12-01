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
  
  // Try this format - models that work with serverless inference
  // Option 1: Phi-2 (smaller, faster)
  const MODEL_API = 'https://api-inference.huggingface.co/models/microsoft/phi-2';
  
  // Option 2: TinyLlama (ultra fast)
  // const MODEL_API = 'https://api-inference.huggingface.co/models/TinyLlama/TinyLlama-1.1B-Chat-v1.0';
  
  // Option 3: Mistral 7B (better quality, slower)
  // const MODEL_API = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

  const COMPANY_KB = `You are DOMINAL AI for Dominal Group only.
Company: Dominal Group
Founder: Yahya Mundewadi
Industry: IT
Services: Software development, AI solutions, web/mobile apps
Only answer about Dominal Group.`;

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

    console.log('=== Calling Model ===');
    console.log('API:', MODEL_API);
    console.log('Message:', message);

    // Simple prompt format
    const prompt = `${COMPANY_KB}\n\nQuestion: ${message}\nAnswer:`;

    // Call API with proper error handling
    const response = await fetch(MODEL_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true'  // Wait if model is loading
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.7,
          return_full_text: false
        }
      })
    });

    const statusCode = response.status;
    console.log('Status:', statusCode);

    if (statusCode === 503) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          data: 'Model is loading... Please wait 20 seconds and try again.'
        })
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', statusCode, errorText);
      throw new Error(`API returned ${statusCode}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Raw data:', JSON.stringify(data));

    // Extract text
    let reply = '';
    if (Array.isArray(data) && data[0]) {
      reply = data[0].generated_text || data[0];
    } else if (data.generated_text) {
      reply = data.generated_text;
    } else if (typeof data === 'string') {
      reply = data;
    }

    reply = String(reply).trim();
    
    // Clean up
    if (reply.includes('Question:')) {
      reply = reply.split('Question:')[0].trim();
    }

    console.log('Reply:', reply);

    if (!reply) {
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
    console.error('Error:', error.message);
    
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
