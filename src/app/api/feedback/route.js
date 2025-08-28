import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const body = await req.json();
    const { taskDescription, imageBase64, mode } = body;
    console.log("✅ taskDescription:", taskDescription);
    console.log("✅ imageBase64 長度:", imageBase64?.length);

    if (!taskDescription || !imageBase64) {
      return NextResponse.json(
        { error: "Missing task description or image" },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "你是一位擅長與人共創的設計夥伴，擅長從設計草圖與任務中激發創意想法。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `以下是使用者正在進行的設計任務描述：\n"${taskDescription}"\n請根據圖像與任務，協助提出簡短的設計延伸建議，總字數請控制在 200 字內，並且依下列三點分段排版，每點獨立一段（段落間請以換行分隔）：

1. 草圖中的概念
2. 創意變化方向
3. 可嘗試的構圖

請用共創者語氣鼓勵對方繼續創作，語句簡潔、有啟發性。`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    });

    const aiReply = response.choices[0].message.content;
    return NextResponse.json({ feedback: aiReply }, { status: 200 });
  } catch (error) {
    console.error("AI Feedback Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI feedback" },
      { status: 500 }
    );
  }
}
