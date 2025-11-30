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

    console.log('=== API Call ===');
    console.log('Message:', message);
    console.log('History length:', history?.length || 0);

    // Step 1: Initiate the call
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
      throw new Error(`API call failed (${callResponse.status}): ${errorText}`);
    }

    const callData = await callResponse.json();
    console.log('Call data:', JSON.stringify(callData));

    if (!callData.event_id) {
      console.error('No event_id in response:', callData);
      throw new Error('No event_id received from API');
    }

    const eventId = callData.event_id;
    console.log('Event ID:', eventId);

    // Step 2: Get result with timeout protection
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout waiting for response')), 30000)
    );

    const fetchPromise = fetch(`${SPACE_URL}/gradio_api/call/chat/${eventId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`
      }
    });

    const resultResponse = await Promise.race([fetchPromise, timeoutPromise]);

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      console.error('Result fetch failed:', resultResponse.status, errorText);
      throw new Error(`Failed to get result (${resultResponse.status}): ${errorText}`);
    }

    const resultText = await resultResponse.text();
    console.log('Raw response (first 500 chars):', resultText.substring(0, 500));

    // Parse SSE (Server-Sent Events) format
    const lines = resultText.split('\n').filter(line => line.trim());
    let reply = null;
    let foundData = false;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        foundData = true;
        const dataContent = line.substring(6).trim();
        
        // Skip event completion messages
        if (dataContent === 'null' || dataContent === '{}') {
          continue;
        }

        try {
          const parsed = JSON.parse(dataContent);
          console.log('Parsed data:', JSON.stringify(parsed));

          // Extract reply from various possible formats
          if (Array.isArray(parsed)) {
            reply = parsed[0];
            break;
          } else if (typeof parsed === 'string') {
            reply = parsed;
            break;
          } else if (parsed && parsed.data) {
            reply = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
            break;
          }
        } catch (parseError) {
          console.log('Parse error for line:', line, parseError.message);
          // If not JSON, might be plain text
          if (dataContent && dataContent.length > 0) {
            reply = dataContent;
          }
        }
      }
    }

    if (!reply) {
      console.error('No valid reply found. Full response:', resultText);
      throw new Error('Could not extract reply from API response. Space might be processing.');
    }

    // Clean up reply
    reply = typeof reply === 'string' ? reply.trim() : String(reply).trim();
    
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
    console.error('=== ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      })
    };
  }
};
