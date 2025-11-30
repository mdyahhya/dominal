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
  
  // Try the correct URL - dots become dashes in HF Space URLs
  const SPACE_URL = 'https://mdyahya-dominal2-5.hf.space/api/predict';

  console.log('=== DEBUG INFO ===');
  console.log('Token exists:', !!HF_TOKEN);
  console.log('Token length:', HF_TOKEN?.length);
  console.log('Token prefix:', HF_TOKEN?.substring(0, 3));
  console.log('Space URL:', SPACE_URL);

  if (!HF_TOKEN) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'HF_TOKEN not configured. Go to Netlify Site Settings > Environment Variables and add HF_TOKEN' 
      })
    };
  }

  try {
    const { message, history } = JSON.parse(event.body);

    console.log('Sending request to HF Space...');
    console.log('Message:', message);

    const response = await fetch(SPACE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_TOKEN}`
      },
      body: JSON.stringify({
        data: [message, history || []]
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HF API Error Response:', errorText);
      
      return {
        statusCode: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: `HuggingFace API Error (${response.status}): ${errorText}`,
          details: 'Check if your Space is running and token has READ permissions'
        })
      };
    }

    const result = await response.json();
    console.log('Success! Result:', JSON.stringify(result).substring(0, 200));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: result.data ? result.data[0] : 'No response received'
      })
    };
  } catch (error) {
    console.error('Fatal Error:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: `Connection failed: ${error.message}`,
        hint: 'Check Netlify Function logs for details'
      })
    };
  }
};
