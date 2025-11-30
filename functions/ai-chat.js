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
  const SPACE_URL = 'https://mdyahya-dominal2-5.hf.space';

  if (!HF_TOKEN) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'HF_TOKEN not configured in Netlify' 
      })
    };
  }

  try {
    const { message, history } = JSON.parse(event.body);

    console.log('Calling HF Space:', SPACE_URL);
    console.log('Message:', message);

    // ChatInterface uses /api/chat endpoint, not /api/predict
    const response = await fetch(`${SPACE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_TOKEN}`
      },
      body: JSON.stringify({
        message: message,
        history: history || []
      })
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HF Error:', errorText);
      
      throw new Error(`HF API returned ${response.status}: ${errorText}`);
    }

    // For ChatInterface, response is plain text (the bot's reply)
    const reply = await response.text();
    console.log('Reply:', reply);

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
