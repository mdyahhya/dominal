const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Handle OPTIONS for CORS
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

  // Get token from environment variable
  const HF_TOKEN = process.env.HF_TOKEN;
  const SPACE_URL = 'https://mdyahya-dominal2-5.hf.space/api/predict';

  // Debug logging (remove after testing)
  console.log('Token exists:', !!HF_TOKEN);
  console.log('Token starts with hf_:', HF_TOKEN?.startsWith('hf_'));

  if (!HF_TOKEN) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'HF_TOKEN environment variable not found in Netlify' 
      })
    };
  }

  try {
    const { message, history } = JSON.parse(event.body);

    console.log('Calling HF Space with message:', message);

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

    console.log('HF Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HF Error:', errorText);
      throw new Error(`HF API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('HF Result:', result);

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
    console.error('Function Error:', error);
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
