// route.js code
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createCanvas, loadImage } from "canvas";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const taskDescription = formData.get("taskDescription");
    const imageFile = formData.get("image");
    const feedbackType = formData.get("feedbackType") || "sketch-text";

    let buffer;
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    let feedback;

    switch (feedbackType) {
      case "sketch-text":
        if (!imageFile) {
          return NextResponse.json(
            { error: "Missing image file for sketch-text feedback." },
            { status: 400 }
          );
        }
        const sketchTextResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 400,
          messages: [
            {
              role: "system",
              content: `你是一位專業的設計導師，請分析使用者的手繪草圖，並給出與長照中心有關的設計改進建議，包括材料、造型、機構等方面的創新方向。`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `設計任務：${taskDescription}，請根據我的草圖給出具體的分析和建議，並以純文字回覆。`,
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
        const fullTextResponse =
          sketchTextResponse.choices?.[0]?.message?.content || "";
        // 🚨 修正：直接將完整回覆作為建議內容
        feedback = {
          type: "text",
          suggestions: fullTextResponse,
          analysis: "",
        };
        break;

      case "sketch-image":
        if (!imageFile) {
          return NextResponse.json(
            { error: "Missing image file for sketch-image feedback." },
            { status: 400 }
          );
        }
        try {
          const analysisResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 200,
            messages: [
              {
                role: "system",
                content: `你是一位專業的設計導師，請分析使用者提供的草圖，並根據其風格和內容，提供具體的改進建議描述。這些建議將直接用於圖像生成，請專注於如何讓設計在長照中心環境下更實用、美觀，且符合人體工學。**請用英文回覆，不要使用中文。**`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `請分析我的草圖，並描述具體的改進建議。這些建議將用於生成一個改進版本的圖像。**請用英文回覆，不要使用中文。**`,
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
          const analysisText =
            analysisResponse.choices?.[0]?.message?.content || "";
          const imageBuffer = buffer;
          const originalImage = await loadImage(imageBuffer);
          const imageWidth = originalImage.width;
          const imageHeight = originalImage.height;
          const totalPixels = imageWidth * imageHeight;
          const MIN_PIXELS = 262144;
          let finalBuffer = imageBuffer;
          if (totalPixels < MIN_PIXELS) {
            const newWidth = 1024;
            const newHeight = 1024;
            const canvas = createCanvas(newWidth, newHeight);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(originalImage, 0, 0, newWidth, newHeight);
            finalBuffer = canvas.toBuffer("image/png");
          }
          const apiHost = "https://api.stability.ai";
          const formData = new FormData();
          formData.append("init_image", new Blob([finalBuffer]), "sketch.png");
          formData.append("steps", "50");
          formData.append("cfg_scale", "7.5");
          formData.append("clip_guidance_preset", "FAST_BLUE");
          formData.append("sampler", "K_DPMPP_2M");
          formData.append("samples", "1");
          formData.append("text_prompts[0][text]", `${analysisText}`);
          formData.append("text_prompts[0][weight]", "0.5");
          formData.append(
            "text_prompts[1][text]",
            "low quality, bad anatomy, ugly, deformed, blurry, grainy, bad composition, watermark, text, signature, cartoon, illustration, amateur, messy background, grey background, dirty background, crowded, busy, distracting elements"
          );
          formData.append("text_prompts[1][weight]", "-1");
          const imageResponse = await fetch(
            `${apiHost}/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.STABILITY_AI_API_KEY}`,
                Accept: "application/json",
              },
              body: formData,
            }
          );
          if (!imageResponse.ok) {
            const errorData = await imageResponse.json();
            throw new Error(JSON.stringify(errorData));
          }
          const imageData = await imageResponse.json();
          const suggestions = `data:image/png;base64,${imageData.artifacts[0].base64}`;
          feedback = {
            type: "image",
            suggestions: suggestions,
            analysis: analysisText,
          };
        } catch (error) {
          console.error("圖像生成錯誤:", error);
          feedback = {
            type: "text",
            suggestions: "圖像生成暫時不可用，請參考上方的文字分析建議。",
            analysis: "",
          };
        }
        break;

      case "task-text":
        const taskTextResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 400,
          messages: [
            {
              role: "system",
              content: `你是一位專業的設計導師，請根據設計任務提供創意發想建議。`,
            },
            {
              role: "user",
              content: `設計任務：${taskDescription}，請針對這個設計任務提供創意發想和設計建議，並以純文字回覆。`,
            },
          ],
        });
        const fullTaskTextResponse =
          taskTextResponse.choices?.[0]?.message?.content || "";
        // 🚨 修正：直接將完整回覆作為建議內容
        feedback = {
          type: "text",
          suggestions: fullTaskTextResponse,
          analysis: "",
        };
        break;

      case "task-image":
        const taskImageResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content: `你是一位專業的設計導師，請基於設計任務創造視覺化的設計建議。請詳細描述符合任務需求的設計概念，用於生成參考圖像。**請用英文回覆，不要使用中文。**`,
            },
            {
              role: "user",
              content: `設計任務：${taskDescription}。請針對這個設計任務，詳細描述一個優秀的設計解決方案，包括具體的視覺特徵、功能元素、材料質感等，用於生成參考圖像。**請用英文回覆，不要使用中文。**`,
            },
          ],
        });
        const taskImageDescription =
          taskImageResponse.choices?.[0]?.message?.content || "";
        const dallEResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: `Design concept for: ${taskDescription}. ${taskImageDescription}.`,
          size: "1024x1024",
          quality: "standard",
          n: 1,
        });
        feedback = {
          type: "image",
          suggestions: dallEResponse.data[0].url,
          analysis: taskImageDescription,
        };
        break;

      default:
        return NextResponse.json(
          { error: "Invalid feedback type" },
          { status: 400 }
        );
    }

    return NextResponse.json({ feedback }, { status: 200 });
  } catch (error) {
    console.error("API 回饋錯誤：", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
