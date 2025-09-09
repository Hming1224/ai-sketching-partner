// route.js code
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const taskDescription = formData.get("taskDescription");
    const imageFile = formData.get("image");
    const feedbackType = formData.get("feedbackType") || "sketch-text";
    const targetUser = formData.get("targetUser") || "";
    const userNeed = formData.get("userNeed") || "";

    let buffer;
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    let feedback;
    let aiIdea = {};

    const sharedIdeationPrompt_sketch = `You are an innovative industrial designer specializing in Long-term Care Center furniture.
          Analyze the user's sketch and the design context: "${taskDescription}".
          
          **Context:** The design is for a chair in a long-term care facility.
          ${targetUser ? `**Target User:** ${targetUser}` : ""}
          ${userNeed ? `**Key User Need:** ${userNeed}` : ""}

          Your tasks are:
          1.  **Analyze the sketch's style.** Describe its visual characteristics in detail.
          2.  **Ideate THREE concrete improvements.** Provide one actionable modification for each of the following aspects: **Function**, **Structure**, and **Material**. Each suggestion should be suitable for the context and the provided user needs.
          
          Respond ONLY with a valid JSON object in the following format, with no other text before or after it:
          {
            
            "modification_function_english": "A concise sentence in English describing a functional idea.",
            "modification_structure_english": "A concise sentence in English describing a structural idea.",
            "modification_material_english": "A concise sentence in English describing a material idea.",
            "target_user_english": "${targetUser || "N/A"}",
            "key_user_need_english": "${userNeed || "N/A"}"
          }`;

    const sharedIdeationPrompt_task = `You are an innovative industrial designer specializing in Long-term Care Center furniture.
          Analyze the design context: "${taskDescription}".
          
          **Context:** The design is for a chair in a long-term care facility.

          Your tasks are:
          1.  **Define the User & Need:** Based on the context, identify a specific **target user** and their most critical **user need**.
          2.  **Ideate THREE concrete improvements.** Provide one actionable modification for each of the following aspects: **Function**, **Structure**, and **Material**. Each suggestion should be suitable for the context and the user needs you've defined.
          
          Your response must be in the following exact format. Do not add any extra text. Each response must be concise.
          
          Target User: [AI-defined Target User]
          Key User Need: [AI-defined Key User Need]
          Function: [AI-defined Function Suggestion]
          Structure: [AI-defined Structure Suggestion]
          Material: [AI-defined Material Suggestion]`;

    const getTranslation = async (text) => {
      if (!text) return "";
      try {
        const translationModel = genAI.getGenerativeModel({
          model: "gemini-1.5-pro-latest",
        });
        const result = await translationModel.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Translate the following into professional Traditional Chinese. Only provide the translation and nothing else:\n\n${text}`,
                },
              ],
            },
          ],
        });
        return result.response.text();
      } catch (error) {
        console.error("Translation API error:", error);
        return text;
      }
    };

    const getAiIdeation = async (prompt, isSketchMode, imagePart) => {
      let responseText;
      try {
        if (isSketchMode) {
          const ideationModel = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
          });
          const result = await ideationModel.generateContent([
            { text: prompt },
            imagePart,
          ]);
          responseText = result.response.text();
        } else {
          const textModel = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
          });
          const result = await textModel.generateContent([{ text: prompt }]);
          responseText = result.response.text();
        }
      } catch (e) {
        console.error("Gemini API call failed:", e);
        throw new Error(
          "AI Ideation API call failed. Please check the API key and network connection."
        );
      }

      let parsedData = {};
      try {
        if (isSketchMode) {
          const cleanedJsonText = responseText.replace(/^```json\n|```$/g, "");
          parsedData = JSON.parse(cleanedJsonText);
        } else {
          const lines = responseText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          lines.forEach((line) => {
            const [key, ...valueParts] = line.split(":");
            const value = valueParts.join(":").trim();
            if (key === "Target User") parsedData.target_user_english = value;
            if (key === "Key User Need")
              parsedData.key_user_need_english = value;
            if (key === "Function")
              parsedData.modification_function_english = value;
            if (key === "Structure")
              parsedData.modification_structure_english = value;
            if (key === "Material")
              parsedData.modification_material_english = value;
          });
        }
        return parsedData;
      } catch (e) {
        console.error("JSON/Text parsing error:", e.message);
        throw new Error(
          `AI (Ideation) failed to return a valid structured response. AI response was:\n${responseText}`
        );
      }
    };

    try {
      let isSketchMode = feedbackType.includes("sketch");
      let imagePart =
        isSketchMode && imageFile
          ? {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: imageFile.type,
              },
            }
          : null;
      let prompt = isSketchMode
        ? sharedIdeationPrompt_sketch
        : sharedIdeationPrompt_task;

      aiIdea = await getAiIdeation(prompt, isSketchMode, imagePart);

      let suggestions_url = null;
      if (feedbackType === "sketch-image" || feedbackType === "task-image") {
        const imageGenModel = genAI.getGenerativeModel({
          model: "gemini-2.5-flash-image-preview",
        });
        const combined_modification_idea = `A design sketch of a chair for a long-term care facility, incorporating the following ideas: 1. Function: ${aiIdea.modification_function_english}. 2. Structure: ${aiIdea.modification_structure_english}. 3. Material: ${aiIdea.modification_material_english}.`;

        let imageGenResult;
        if (isSketchMode) {
          const executionTextPrompt = `Act as a skilled sketch artist who perfectly mimics other styles. Your task is to modify the base sketch with the following changes: ${combined_modification_idea}`;
          imageGenResult = await imageGenModel.generateContent([
            { text: executionTextPrompt },
            imagePart,
          ]);
        } else {
          imageGenResult = await imageGenModel.generateContent([
            { text: combined_modification_idea },
          ]);
        }

        const imagePartResponse =
          imageGenResult.response.candidates?.[0]?.content?.parts?.find(
            (p) => p.inlineData
          );
        if (!imagePartResponse) {
          throw new Error("Gemini (Image Gen) did not return an image.");
        }
        suggestions_url = `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`;
      }

      const translatedData = {};
      const keys = [
        "target_user_english",
        "key_user_need_english",
        "modification_function_english",
        "modification_structure_english",
        "modification_material_english",
      
      ];
      for (const key of keys) {
        if (aiIdea[key]) {
          translatedData[key.replace("_english", "_chinese")] =
            await getTranslation(aiIdea[key]);
        }
      }

      feedback = {
        type: feedbackType.includes("image") ? "image" : "text",
        suggestions: suggestions_url,
        analysis: { ...aiIdea, ...translatedData },
      };
    } catch (error) {
      console.error("AI 回饋生成錯誤:", error);
      feedback = {
        type: "text",
        suggestions: null,
        analysis: { error: error.message },
      };
    }

    return NextResponse.json({ feedback }, { status: 200 });
  } catch (error) {
    console.error("API 回饋錯誤：", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
