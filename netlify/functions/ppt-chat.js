const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { messages, systemPrompt, action } = JSON.parse(event.body);

    // PPT-specific system prompt
    const pptSystemPrompt = systemPrompt || `You are AI PPT Maker Agent by Yahya, a professional presentation creator.

IMPORTANT RULES:
1. Guide users through 6 steps conversationally
2. Use friendly, helpful tone suitable for students/professionals
3. Generate professional, humanized slide content for college seminars
4. Always respond in simple, clear language
5. For content generation, create 2-3 sentences per slide, optimized for presentation slides
6. Return slide titles/content in structured format when requested

STEPS TO FOLLOW:
1. Get user name (for title slide)
2. Get presentation topic
3. Get tone (college_seminar, technical, business, educational)
4. Get slide count (5-20 slides)
5. Generate/Ask for slide points structure
6. Generate content for each slide
7. Offer PDF download

When generating slide structure for [TOPIC]:
- Title/Index slide
- Introduction  
- 3-5 main content points
- Usage/Applications
- Advantages/Benefits
- Future Scope
- Conclusion

Format content responses as: "Slide 1: [title]\n[content]\n\nSlide 2: [title]\n[content]"`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            content: pptSystemPrompt
          },
          ...messages
        ],
        temperature: 0.3,           // Consistent, professional responses
        max_tokens: 1200,           // Higher limit for complete PPT content
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`);
    }

    const data = await groqResponse.json();
    const reply = data.choices[0].message.content.trim();

    // Enhanced response with metadata for frontend
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        reply: reply,
        tokens_used: data.usage?.total_tokens || 0,
        model: data.model,
        conversation_id: Date.now().toString()
      })
    };

  } catch (error) {
    console.error('PPT Chat Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message || 'Failed to process PPT request',
        reply: 'Sorry, I encountered an error creating your presentation. Please try again or type "start" to begin again.'
      })
    };
  }
};
