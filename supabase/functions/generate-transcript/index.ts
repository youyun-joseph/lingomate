import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sourceType, sourceUrl, contextText } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) throw new Error('GEMINI_API_KEY not set')

    const prompt = `
      You are a professional transcription engine.
      Generate a REALISTIC, TIMESTAMPED transcript based on this context: "${contextText}".
      Source URL: ${sourceUrl}
      
      Output STRICT JSON format only. No markdown.
      Schema: Array<{ text: string, start: number, end: number, speaker: string }>
    `

    // Use gemini-1.5-flash for stability
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

    const data = await response.json()
    
    // Check if Google returned an error
    if (data.error) {
      throw new Error(`Google API Error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!text) {
       throw new Error('No text generated from Gemini')
    }

    // Clean markdown if Gemini adds it
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const transcript = JSON.parse(jsonStr)

    return new Response(
      JSON.stringify({ transcript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})