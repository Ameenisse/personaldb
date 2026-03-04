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
  model: string,
  systemPrompt: string,
  apiKey: string
): Promise<MatchResult[]> {
  const imageContents = batch.map((p) => ({
    type: "image_url" as const,
    image_url: { url: p.photoUrl },
  }));

  const idList = batch
    .map((p, idx) => `Image ${idx + 1} = person ID "${p.id}"`)
    .join("\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Reference face photo:" },
            { type: "image_url", image_url: { url: capturedImage } },
            { type: "text", text: `Person photos to compare against:\n${idList}` },
            ...imageContents,
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_matches",
            description: "Report which person IDs match the reference face with confidence scores",
            parameters: {
              type: "object",
              properties: {
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "The person ID" },
                      confidence: {
                        type: "number",
                        description: "Confidence score 0-100 that this person matches the reference face",
                      },
                    },
                    required: ["id", "confidence"],
                    additionalProperties: false,
                  },
                  description: "Array of matches with confidence scores. Empty array if no matches.",
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
    console.error(`AI gateway error (${model}):`, status, text);
    if (status === 429 || status === 402) {
      throw new Error(status === 429 ? "Rate limit exceeded. Please try again later." : "AI credits exhausted. Please add funds.");
    }
    return [];
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      if (args.matches && Array.isArray(args.matches)) {
        return args.matches;
      }
      // Backwards compat: if model returns matched_ids instead
      if (args.matched_ids && Array.isArray(args.matched_ids)) {
        return args.matched_ids.map((id: string) => ({ id, confidence: 85 }));
      }
    } catch (e) {
      console.error("Failed to parse tool call arguments:", e);
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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!personPhotos || personPhotos.length === 0) {
      return new Response(JSON.stringify({ matchedIds: [], matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batchSize = 20;

    // ===== PASS 1: Fast screening with gemini-2.5-flash-lite =====
    const pass1Prompt =
      "You are a fast face screening system. Compare the reference face against numbered person photos. Report ANY person that COULD be the same individual (even if you're only ~60% sure). Focus on general face shape, skin tone, and prominent features. Include borderline cases — false positives are acceptable at this stage. For each potential match, provide a confidence score 0-100.";

    const pass1Batches: PersonPhoto[][] = [];
    for (let i = 0; i < personPhotos.length; i += batchSize) {
      pass1Batches.push(personPhotos.slice(i, i + batchSize));
    }

    // Run all pass 1 batches in PARALLEL
    const pass1Results = await Promise.allSettled(
      pass1Batches.map((batch) =>
        runBatch(capturedImage, batch, "google/gemini-2.5-flash-lite", pass1Prompt, LOVABLE_API_KEY)
      )
    );

    // Collect candidates from pass 1 (threshold >= 50%)
    const candidates: PersonPhoto[] = [];
    for (const result of pass1Results) {
      if (result.status === "fulfilled") {
        for (const match of result.value) {
          if (match.confidence >= 50) {
            const person = personPhotos.find((p: PersonPhoto) => p.id === match.id);
            if (person && !candidates.find((c) => c.id === person.id)) {
              candidates.push(person);
            }
          }
        }
      } else {
        // Check for rate limit / payment errors
        const errMsg = result.reason?.message || "";
        if (errMsg.includes("Rate limit") || errMsg.includes("credits")) {
          const status = errMsg.includes("Rate limit") ? 429 : 402;
          return new Response(JSON.stringify({ error: errMsg }), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ matchedIds: [], matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== PASS 2: Precise matching with gemini-3-flash-preview =====
    const pass2Prompt =
      "You are a precise face verification system. You receive a reference face photo and candidate person photos that passed initial screening. Carefully verify if each candidate is the SAME individual as the reference. Focus on facial bone structure, eye shape and spacing, nose bridge and tip shape, jawline contour, ear shape, and hairline pattern. Ignore differences in lighting, angle, expression, age variation (up to ~10 years), glasses, facial hair, makeup, or head coverings. For each match, provide a confidence score 0-100. Only report matches where you are genuinely confident.";

    const pass2Batches: PersonPhoto[][] = [];
    for (let i = 0; i < candidates.length; i += batchSize) {
      pass2Batches.push(candidates.slice(i, i + batchSize));
    }

    // Run all pass 2 batches in PARALLEL
    const pass2Results = await Promise.allSettled(
      pass2Batches.map((batch) =>
        runBatch(capturedImage, batch, "google/gemini-3-flash-preview", pass2Prompt, LOVABLE_API_KEY)
      )
    );

    // Collect final matches (threshold >= 85%)
    const finalMatches: MatchResult[] = [];
    for (const result of pass2Results) {
      if (result.status === "fulfilled") {
        for (const match of result.value) {
          if (match.confidence >= 85) {
            finalMatches.push(match);
          }
        }
      }
    }

    // Sort by confidence descending
    finalMatches.sort((a, b) => b.confidence - a.confidence);

    return new Response(
      JSON.stringify({
        matchedIds: finalMatches.map((m) => m.id),
        matches: finalMatches,
        stats: {
          totalPhotos: personPhotos.length,
          pass1Candidates: candidates.length,
          finalMatches: finalMatches.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("face-match error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
