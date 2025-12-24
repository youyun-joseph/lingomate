// Follow this setup guide to integrate the Deno language server with your editor:
// [https://deno.land/manual/getting_started/setup_your_environment](https://deno.land/manual/getting_started/setup_your_environment)
// This enables autocomplete, go to definition, etc.

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
    const { sourceType, sourceUrl, contextText } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in Supabase secrets.')
    }

    const prompt = `
      You are a professional transcription engine.
      Generate a REALISTIC, TIMESTAMPED transcript based on this context: "${contextText}".
      Source URL: ${sourceUrl}
      
      Output STRICT JSON format only. No markdown.
      Schema: Array<{ text: string, start: number, end: number, speaker: string }>
    `

    // Use gemini-1.5-flash for stability
    console.log("Calling Gemini API...")
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
        throw new Error(`Gemini API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log("Gemini API Data Received")

    // Check if Google returned an error structure
    if (data.error) {
      throw new Error(`Google API Error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!text) {
       console.error("Full Data Object:", JSON.stringify(data))
       throw new Error('No text generated from Gemini. Check logs for full object.')
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

