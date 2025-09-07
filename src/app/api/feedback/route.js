// route.js code
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createCanvas, loadImage } from "canvas";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

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
        // ... 此區塊維持不變
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
        feedback = {
          type: "text",
          suggestions: fullTextResponse,
          analysis: "",
        };
        break;

      // START: MODIFIED TO USE GEMINI FOR IMAGE GENERATION
      case "sketch-image":
        if (!imageFile) {
          return NextResponse.json(
            { error: "Missing image file for sketch-image feedback." },
            { status: 400 }
          );
        }
        try {
          // ==========================================================
          // 步驟 1: AI 創意發想與視覺分析 (使用 Gemini)
          // ==========================================================
          const ideationModel = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
          });
          const imagePart = {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: imageFile.type,
            },
          };
          const ideationPrompt = `You are an innovative industrial designer specializing in healthcare furniture.
          Analyze the user's sketch and the design context: "${taskDescription}".
          
          Your tasks are:
          1.  **Ideate ONE concrete improvement.** Choose one aspect (Function, Material, or Structure) and propose a single, actionable modification suitable for the context.
          2.  **Analyze the sketch's style.** Describe its visual characteristics in detail.
          
          Respond ONLY with a valid JSON object in the following format, with no other text before or after it:
          {
            "aspect": "Function | Material | Structure",
            "modification_idea_english": "A concise sentence in English describing your idea. For example: 'Add small, lockable caster wheels to the legs.'",
            "sketch_style_analysis_english": "A detailed English description of the sketch's style, including line quality, perspective, and form. For example: 'A simple, hand-drawn sketch with thick, slightly wobbly black lines and a clean 3/4 perspective.'"
          }`;

          // 🚨 修正點 #1：直接傳遞 Parts 陣列
          const ideationResult = await ideationModel.generateContent([
            { text: ideationPrompt },
            imagePart,
          ]);
          const ideationResponseText = ideationResult.response.text();

          // ==========================================================
          // 步驟 2: 解析 AI 的 JSON 回應
          // ==========================================================
          let aiIdea;
          try {
            const cleanedJsonText = ideationResponseText.replace(
              /^```json\n|```$/g,
              ""
            );
            aiIdea = JSON.parse(cleanedJsonText);
          } catch (e) {
            throw new Error(
              "AI (Ideation) failed to return valid JSON. Please try again."
            );
          }

          const { modification_idea_english, sketch_style_analysis_english } =
            aiIdea;

          // ==========================================================
          // 步驟 3: 組合給 Gemini 的【繪圖】指令
          // ==========================================================
          const executionTextPrompt = `Act as a skilled sketch artist who perfectly mimics other styles.
          
          **Target Style to Replicate:**
          You MUST perfectly replicate the original's hand-drawn style as described here: "${sketch_style_analysis_english}". The perspective, composition, and line quality must be identical. The final image should look like it was drawn by the same person who created the original sketch.
          
          **Required Modification:**
          Integrate ONLY the following change into the base sketch: "${modification_idea_english}"`;

          // ==========================================================
          // 步驟 4: 執行繪圖 (使用 Gemini)
          // ==========================================================
          const imageGenModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-image-preview",
          });

          const executionPromptParts = [
            { text: executionTextPrompt },
            imagePart,
          ];

          // 🚨 修正點 #2：直接傳遞 Parts 陣列
          const imageGenResult = await imageGenModel.generateContent(
            executionPromptParts
          );
          const imageGenResponse = imageGenResult.response;

          const imagePartResponse =
            imageGenResponse.candidates?.[0]?.content?.parts?.find(
              (part) => part.inlineData
            );

          if (!imagePartResponse) {
            throw new Error("Gemini (Image Gen) did not return an image.");
          }

          const base64ImageData = imagePartResponse.inlineData.data;
          const mimeType = imagePartResponse.inlineData.mimeType;
          const suggestions = `data:${mimeType};base64,${base64ImageData}`;

          feedback = {
            type: "image",
            suggestions: suggestions,
            analysis: `AI Suggestion (${aiIdea.aspect}):\n${modification_idea_english}`,
          };
        } catch (error) {
          console.error("圖像生成錯誤:", error);
          feedback = {
            type: "text",
            suggestions:
              "圖像生成失敗，AI 可能無法理解圖片或生成有效的想法，請稍後再試。",
            analysis: error.message,
          };
        }
        break;
      // END: FIXED API CALL FORMAT

      case "task-text":
        // ... 此區塊維持不變
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
        feedback = {
          type: "text",
          suggestions: fullTaskTextResponse,
          analysis: "",
        };
        break;

      case "task-image":
        // ... 此區塊維持不變
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
        const dallEResponseForTask = await openai.images.generate({
          model: "dall-e-3",
          prompt: `Design concept for: ${taskDescription}. ${taskImageDescription}.`,
          size: "1024x1024",
          quality: "standard",
          n: 1,
        });
        feedback = {
          type: "image",
          suggestions: dallEResponseForTask.data[0].url,
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
