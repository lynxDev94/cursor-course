// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'
import { corsHeaders } from '../_lib/cors.ts'

interface ChatRequest {
  message: string
  mode: 'text' | 'image'
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

console.log("Hello from Functions!")

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, mode, conversationHistory = [] }: ChatRequest = await req.json()
    
    // Validate input
    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (mode !== 'text' && mode !== 'image') {
      return new Response(
        JSON.stringify({ error: 'Mode must be "text" or "image"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // For now, only handle text mode
    if (mode === 'image') {
      return new Response(
        JSON.stringify({ error: 'Image generation not implemented yet' }),
        { 
          status: 501, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    })

    // Build conversation context (keep last 8 messages)
    const recentHistory = conversationHistory.slice(-8)
    const messages = [
      ...recentHistory,
      { role: 'user' as const, content: message }
    ]

    // Call OpenAI API
    const chatCompletion = await openai.chat.completions.create({
      messages,
      model: 'gpt-3.5-turbo', // Cheapest option
      max_tokens: 500, // Limit response length
      temperature: 0.7, // Balanced creativity
      stream: false, // No streaming for now
    })

    const reply = chatCompletion.choices[0].message.content

    return new Response(
      JSON.stringify({ 
        response: reply,
        conversationHistory: [
          ...recentHistory,
          { role: 'user', content: message },
          { role: 'assistant', content: reply }
        ]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Chat function error:', error)
    
    // Handle specific OpenAI errors
    if (error.message?.includes('rate_limit')) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    if (error.message?.includes('insufficient_quota')) {
      return new Response(
        JSON.stringify({ error: 'OpenAI quota exceeded. Please try again later.' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'An error occurred while processing your request.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/chat' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
