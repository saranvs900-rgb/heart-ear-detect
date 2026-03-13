import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAIWithRetry(body: string, apiKey: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (response.status === 429) {
      const waitMs = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;
      console.log(`Rate limited, waiting ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    return response;
  }

  throw new Error("Rate limited after max retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript } = await req.json();
    if (!transcript || transcript.trim().length < 3) {
      return new Response(JSON.stringify({ error: "No valid transcript provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const requestBody = JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a voice tone and sentiment analysis AI. Analyze the transcript for emotional tone, sentiment, and vocal cues implied by word choice and phrasing. You MUST respond with ONLY a valid JSON object, no markdown, no explanation. The format must be exactly:
{"tones":{"calm":0,"stressed":0,"joyful":0,"irritated":0,"confident":0,"hesitant":0,"enthusiastic":0,"melancholic":0},"dominant_tone":"calm","sentiment":"neutral","sentiment_score":0,"energy_level":0,"summary":"brief description of detected vocal emotion and tone"}
- tones: 0-100, should roughly sum to 100
- sentiment: "positive", "negative", or "neutral"
- sentiment_score: -100 to 100 (negative to positive)
- energy_level: 0-100
If transcript is too short or unclear, make your best guess.`,
        },
        {
          role: "user",
          content: `Analyze the emotional tone and sentiment of this spoken transcript:\n\n"${transcript}"`,
        },
      ],
    });

    const response = await callAIWithRetry(requestBody, LOVABLE_API_KEY);

    if (!response.ok) {
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = {
        tones: { calm: 50, stressed: 0, joyful: 0, irritated: 0, confident: 0, hesitant: 0, enthusiastic: 0, melancholic: 0 },
        dominant_tone: "calm",
        sentiment: "neutral",
        sentiment_score: 0,
        energy_level: 50,
        summary: "Could not analyze tone",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limited") ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
