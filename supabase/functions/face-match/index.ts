import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PersonPhoto {
  id: string;
  photoUrl: string;
}

interface MatchResult {
  id: string;
  confidence: number;
}

async function runBatch(
  capturedImage: string,
  batch: PersonPhoto[],
  apiKey: string
): Promise<MatchResult[]> {
  const imageContents = batch.map((p) => ({
    type: "image_url" as const,
    image_url: { url: p.photoUrl },
  }));

  const idList = batch
    .map((p, idx) => `Image ${idx + 1} = ID "${p.id}"`)
    .join("\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "You are a precise face identification system. You receive one reference face and numbered candidate photos. Identify which candidates show the SAME person as the reference. Analyze: skull shape, eye shape/spacing/depth, nose bridge width/tip shape, jawline contour, cheekbone prominence, ear shape/size, philtrum length, lip shape. Ignore: lighting, angle, expression, age (±15yr), glasses, facial hair, makeup, head coverings, image quality. Report matches with confidence 0-100. Only include matches with confidence ≥ 85.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Reference face:" },
            { type: "image_url", image_url: { url: capturedImage } },
            { type: "text", text: `Candidates:\n${idList}` },
            ...imageContents,
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_matches",
            description: "Report matching person IDs with confidence scores",
            parameters: {
              type: "object",
              properties: {
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["id", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["matches"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_matches" } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    console.error(`AI error:`, status, text);
    if (status === 429 || status === 402) {
      throw new Error(status === 429 ? "RATE_LIMIT" : "CREDITS_EXHAUSTED");
    }
    return [];
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      if (args.matches && Array.isArray(args.matches)) {
        return args.matches.filter((m: MatchResult) => m.confidence >= 85);
      }
      if (args.matched_ids && Array.isArray(args.matched_ids)) {
        return args.matched_ids.map((id: string) => ({ id, confidence: 90 }));
      }
    } catch (e) {
      console.error("Parse error:", e);
    }
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capturedImage, personPhotos } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!personPhotos || personPhotos.length === 0) {
      return new Response(JSON.stringify({ matchedIds: [], matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single pass: all batches run in PARALLEL for maximum speed
    const batchSize = 25;
    const batches: PersonPhoto[][] = [];
    for (let i = 0; i < personPhotos.length; i += batchSize) {
      batches.push(personPhotos.slice(i, i + batchSize));
    }

    const results = await Promise.allSettled(
      batches.map((batch) => runBatch(capturedImage, batch, LOVABLE_API_KEY))
    );

    const allMatches: MatchResult[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        allMatches.push(...result.value);
      } else {
        const msg = result.reason?.message || "";
        if (msg === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (msg === "CREDITS_EXHAUSTED") {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Deduplicate by ID, keep highest confidence
    const bestMap = new Map<string, MatchResult>();
    for (const m of allMatches) {
      const existing = bestMap.get(m.id);
      if (!existing || m.confidence > existing.confidence) {
        bestMap.set(m.id, m);
      }
    }

    const finalMatches = Array.from(bestMap.values()).sort((a, b) => b.confidence - a.confidence);

    return new Response(
      JSON.stringify({
        matchedIds: finalMatches.map((m) => m.id),
        matches: finalMatches,
        stats: { totalPhotos: personPhotos.length, batches: batches.length, finalMatches: finalMatches.length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("face-match error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
