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
        error: 'HF_TOKEN not configured' 
      })
    };
  }

  try {
    const { message, history } = JSON.parse(event.body);

    console.log('=== Calling Gradio API ===');
    console.log('Message:', message);

    // Step 1: Call the endpoint to get event_id
    const callResponse = await fetch(`${SPACE_URL}/gradio_api/call/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_TOKEN}`
      },
      body: JSON.stringify({
        data: [message, history || []]
      })
    });

    if (!callResponse.ok) {
      const errorText = await callResponse.text();
      console.error('Call failed:', callResponse.status, errorText);
      throw new Error(`API call failed: ${callResponse.status} - ${errorText}`);
    }

    const callData = await callResponse.json();
    console.log('Call response:', callData);

    if (!callData.event_id) {
      throw new Error('No event_id received from API');
    }

    const eventId = callData.event_id;

    // Step 2: Get the result using event_id with streaming endpoint
    const resultResponse = await fetch(`${SPACE_URL}/gradio_api/call/chat/${eventId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`
      }
    });

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      console.error('Result fetch failed:', resultResponse.status, errorText);
      throw new Error(`Failed to get result: ${resultResponse.status} - ${errorText}`);
    }

    // Parse Server-Sent Events (SSE) response
    const resultText = await resultResponse.text();
    console.log('Raw result:', resultText);

    // Extract the data from SSE format
    const lines = resultText.split('\n');
    let reply = null;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          
          // Look for the actual response data
          if (data && Array.isArray(data)) {
            reply = data[0]; // The bot's reply is the first element
            break;
          }
        } catch (e) {
          console.log('Could not parse line:', line);
        }
      }
    }

    if (!reply) {
      // Try to extract any text from the response
      const dataMatch = resultText.match(/data: (.+)/);
      if (dataMatch) {
        try {
          const parsed = JSON.parse(dataMatch[1]);
          reply = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch (e) {
          reply = resultText;
        }
      } else {
        throw new Error('No reply found in response');
      }
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
    console.error('Stack:', error.stack);
    
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
