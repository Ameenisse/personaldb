import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capturedImage, personPhotos } = await req.json();
    // capturedImage: base64 data URL
    // personPhotos: array of { id, photoUrl }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!personPhotos || personPhotos.length === 0) {
      return new Response(JSON.stringify({ matchedIds: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in batches of 15 for faster results
    const batchSize = 15;
    const allMatchedIds: string[] = [];

    for (let i = 0; i < personPhotos.length; i += batchSize) {
      const batch = personPhotos.slice(i, i + batchSize);

      const imageContents = batch.map((p: { id: string; photoUrl: string }, idx: number) => ({
        type: "image_url" as const,
        image_url: { url: p.photoUrl },
      }));

      const idList = batch.map((p: { id: string }, idx: number) => `Image ${idx + 1} = person ID "${p.id}"`).join("\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are a precise face matching system. You receive a reference face photo and several numbered person photos. Identify which person photos show the SAME individual as the reference. Focus on facial bone structure, eye shape/spacing, nose shape, jawline, and ear shape. Ignore differences in lighting, angle, expression, age variation, glasses, facial hair, or head coverings. Only report a match if you are at least 85% confident. If uncertain, do NOT include that ID.",
            },
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
                description: "Report which person IDs match the reference face",
                parameters: {
                  type: "object",
                  properties: {
                    matched_ids: {
                      type: "array",
                      items: { type: "string" },
                      description: "Array of person IDs whose face matches the reference photo. Empty array if no matches.",
                    },
                  },
                  required: ["matched_ids"],
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
        console.error(`AI gateway error (batch ${i / batchSize}):`, status, text);

        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Skip this batch on error, continue with others
        continue;
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          if (args.matched_ids && Array.isArray(args.matched_ids)) {
            allMatchedIds.push(...args.matched_ids);
          }
        } catch (e) {
          console.error("Failed to parse tool call arguments:", e);
        }
      }
    }

    return new Response(JSON.stringify({ matchedIds: allMatchedIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
