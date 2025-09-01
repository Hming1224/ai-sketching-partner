import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const taskDescription = formData.get("taskDescription");
    const imageFile = formData.get("image");
    const feedbackType = formData.get("feedbackType") || "sketch-text"; // 預設為草圖文字分析

    let buffer;
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    let response;
    let feedback;

    switch (feedbackType) {
      case "sketch-text":
        // 方法1: 根據草圖給予文字建議
        if (!imageFile) {
          return NextResponse.json(
            { error: "Missing image file for sketch-text feedback." },
            { status: 400 }
          );
        }

        response = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 400,
          messages: [
            {
              role: "system",
              content: `你是一位專業的設計導師，請分析使用者的手繪草圖，並給出與長照中心有關的設計改進建議，包括材料、造型、機構等方面的創新方向。
請以 JSON 格式回覆，包含以下兩個欄位：
{
  "analysis": "描述你在草圖中看到的設計概念、物件形狀、功能元素等分析內容",
  "suggestions": "提供具體、建設性的改進建議"
}
每個欄位內容約80-100字，語氣友善且具建設性。`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `設計任務：${taskDescription}，請根據我的草圖給出具體的分析和建議，並以純 JSON 格式和列點的方式回覆（不要使用 markdown 代碼塊）。`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${imageFile.type};base64,${buffer.toString(
                      "base64"
                    )}`,
                  },
                },
              ],
            },
          ],
        });
        feedback = await parseTextResponse(response);
        break;

      case "sketch-image":
        // 方法2: 根據草圖給予圖像建議
        if (!imageFile) {
          return NextResponse.json(
            { error: "Missing image file for sketch-image feedback." },
            { status: 400 }
          );
        }

        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 200,
          messages: [
            {
              role: "system",
              content: `你是一位專業的設計導師，請分析使用者的草圖，並提供改進建議的具體描述。請專注於視覺改進建議，描述如何讓設計更好，包括形狀、比例、功能性元素的增強、材料質感和人體工學等。`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `設計任務：${taskDescription}。請分析我的草圖並描述具體的改進建議，這些建議將用於生成改進版本的圖像。`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${imageFile.type};base64,${buffer.toString(
                      "base64"
                    )}`,
                  },
                },
              ],
            },
          ],
        });

        const analysisText = analysisResponse.choices?.[0]?.message?.content;

        try {
          const imageResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: `Based on this design task: "${taskDescription}". Create an improved design sketch with these suggestions: ${analysisText}. Style: clean line drawing, technical sketch, professional design illustration.`,
            size: "1024x1024",
            quality: "standard",
            n: 1,
          });

          feedback = {
            analysis: analysisText,
            suggestions: imageResponse.data[0].url,
            type: "image",
          };
          console.log("圖像生成成功");
        } catch (imageError) {
          console.error("圖像生成失敗:", imageError);
          feedback = {
            analysis: analysisText,
            suggestions: "圖像生成暫時不可用，請參考上方的文字分析建議。",
            type: "text",
          };
        }
        break;

      case "task-text":
        // 方法3: 僅根據任務描述給出文字建議
        response = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 400,
          messages: [
            {
              role: "system",
              content: `你是一位專業的設計導師，請根據設計任務提供創意發想建議，並以 JSON 格式回覆。
請包含以下兩個欄位：
{
  "analysis": "針對設計任務的分析和理解，包括設計重點、使用者需求、環境考量等",
  "suggestions": "提供多個創意方向的具體建議，包括功能、造型、材料等面向的發想"
}
每個欄位內容約80-100字，語氣啟發且具建設性。`,
            },
            {
              role: "user",
              content: `設計任務：${taskDescription} 請針對這個設計任務提供創意發想和設計建議，並以純 JSON 格式和列點的方式回覆（不要使用 markdown 代碼塊）。`,
            },
          ],
        });
        feedback = await parseTextResponse(response);
        break;

      case "task-image":
        // 方法4: 僅根據任務描述生成圖像建議
        response = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content: `你是一位專業的設計導師，請基於設計任務創造視覺化的設計建議。請詳細描述符合任務需求的設計概念，用於生成參考圖像。`,
            },
            {
              role: "user",
              content: `設計任務：${taskDescription}。請針對這個設計任務，詳細描述一個優秀的設計解決方案，包括具體的視覺特徵、功能元素、材料質感等，用於生成參考圖像。`,
            },
          ],
        });

        const taskImageDescription = response.choices?.[0]?.message?.content;
        const taskImageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: `Design concept for: ${taskDescription}. ${taskImageDescription}.`,
          size: "1024x1024",
          quality: "standard",
          n: 1,
        });

        feedback = {
          analysis: "基於設計任務需求，AI 生成了創意發想的視覺化參考。",
          suggestions: taskImageResponse.data[0].url,
          type: "image",
        };
        break;

      default:
        throw new Error("Invalid feedback type");
    }

    return NextResponse.json({ feedback, feedbackType }, { status: 200 });
  } catch (error) {
    console.error("API 回饋錯誤：", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 輔助函數：解析文字回應
async function parseTextResponse(response) {
  const aiResponse = response.choices?.[0]?.message?.content;

  try {
    // 嘗試移除 markdown 代碼塊
    let cleanResponse = aiResponse.replace(/```json\s*|```\s*/g, "");
    cleanResponse = cleanResponse.trim();

    // 嘗試解析 JSON
    const parsedResponse = JSON.parse(cleanResponse);

    // 檢查回傳的 JSON 格式是否符合預期
    if (parsedResponse.analysis || parsedResponse.suggestions) {
      return {
        analysis: parsedResponse.analysis || "無法取得分析內容。",
        suggestions: parsedResponse.suggestions || "無法取得建議內容。",
        type: "text",
      };
    } else {
      // 如果 JSON 格式不符預期，視為異常
      throw new Error("JSON format is not as expected.");
    }
  } catch (error) {
    console.error("JSON 解析失敗:", error);
    // 即使解析失敗，嘗試用正則表達式提取
    const analysisMatch = aiResponse.match(/"analysis":\s*"([^"]*?)"/);
    const suggestionsMatch = aiResponse.match(/"suggestions":\s*"([^"]*?)"/);

    if (analysisMatch || suggestionsMatch) {
      return {
        analysis: analysisMatch ? analysisMatch[1] : "AI 回應格式異常。",
        suggestions: suggestionsMatch
          ? suggestionsMatch[1]
          : "AI 回應格式異常。",
        type: "text",
      };
    } else {
      // 最終解析都失敗，回傳通用錯誤訊息
      return {
        analysis: "AI 回應格式異常。",
        suggestions: "AI 回應格式異常。",
        type: "text",
      };
    }
  }
}
