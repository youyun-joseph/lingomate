// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in Supabase secrets.')
    }

    // Parse Body safely
    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Invalid JSON body received.");
    }
    
    const { sourceType, sourceUrl, contextText } = body;

    const prompt = `
      You are a professional transcription engine.
      Generate a REALISTIC, TIMESTAMPED transcript based on this context: "${contextText || 'General content'}".
      Source URL: ${sourceUrl || 'Unknown'}
      
      Output STRICT JSON format only. No markdown.
      Schema: Array<{ text: string, start: number, end: number, speaker: string }>
    `

    console.log("Calling Gemini 1.5 Flash API...");
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    )

    if (!response.ok) {
        const errorText = await response.text()
        console.error("Gemini API Error Response:", errorText)
        throw new Error(`Google API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    
    // Check if Google returned an error structure inside 200 OK
    if (data.error) {
      throw new Error(`Google API Error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!text) {
       console.error("Full Data Object:", JSON.stringify(data))
       throw new Error('No text generated from Gemini. Check logs for details.')
    }

    // Clean markdown if Gemini adds it
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
    
    let transcript
    try {
        transcript = JSON.parse(jsonStr)
    } catch (e) {
        console.error("JSON Parse Error. String to parse:", jsonStr)
        throw new Error("Failed to parse Gemini response as JSON.")
    }

    return new Response(
      JSON.stringify({ transcript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Edge Function Caught Error:", error.message)
    // Return 200 with error field so client can read message without throwing generic HTTP error
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})