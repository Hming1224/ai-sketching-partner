export async function POST(req) {
  const formData = await req.formData();
  const prompt = formData.get("prompt");
  const image = formData.get("image");

  if (!prompt || !image) {
    return new Response(JSON.stringify({ error: "缺少資料" }), {
      status: 400,
    });
  }

  // 模擬 AI 回饋（未接 OpenAI，可先用來測試流程）
  const feedback = `這是針對「${prompt}」的 AI 模擬回饋結果。`;

  return new Response(JSON.stringify({ feedback }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
