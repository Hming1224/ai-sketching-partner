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
    const targetUser = formData.get("targetUser") || "";
    const userNeed = formData.get("userNeed") || "";

    let buffer;
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    let feedback;
    let suggestions_english = "";
    let analysis_english = "";
    let aiIdea = {};

    const sharedIdeationPrompt = `You are an innovative industrial designer specializing in Long-term Care Center furniture.
          Analyze the user's sketch and the design context: "${taskDescription}".
          
          **Context:** The design is for a chair in a long-term care facility.
          ${targetUser ? `**Target User:** ${targetUser}` : ""}
          ${userNeed ? `**Key User Need:** ${userNeed}` : ""}

          Your tasks are:
          1.  **Analyze the sketch's style.** Describe its visual characteristics in detail.
          2.  **Ideate THREE concrete improvements.** Provide one actionable modification for each of the following aspects: **Function**, **Structure**, and **Material**. Each suggestion should be suitable for the context and the provided user needs.
          
          Respond ONLY with a valid JSON object in the following format, with no other text before or after it:
          {
            "sketch_style_analysis_english": "A detailed English description of the sketch's style, including line quality, perspective, and form. For example: 'A simple, hand-drawn sketch with thick, slightly wobbly black lines and a clean 3/4 perspective.'",
            "modification_function_english": "A concise sentence in English describing a functional idea.",
            "modification_structure_english": "A concise sentence in English describing a structural idea.",
            "modification_material_english": "A concise sentence in English describing a material idea.",
            "target_user_english": "${targetUser || "N/A"}",
            "key_user_need_english": "${userNeed || "N/A"}"
          }`;

    switch (feedbackType) {
      case "sketch-text":
        if (!imageFile) {
          return NextResponse.json(
            { error: "Missing image file for sketch-text feedback." },
            { status: 400 }
          );
        }
        try {
          const textModel = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
          });
          const imagePart = {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: imageFile.type,
            },
          };

          const result = await textModel.generateContent([
            { text: sharedIdeationPrompt },
            imagePart,
          ]);
          const responseText = result.response.text();

          try {
            const cleanedJsonText = responseText.replace(
              /^```json\n|```$/g,
              ""
            );
            aiIdea = JSON.parse(cleanedJsonText);
          } catch (e) {
            throw new Error(
              "AI (Ideation) failed to return valid JSON. Please try again."
            );
          }

          const {
            target_user_english,
            key_user_need_english,
            modification_function_english,
            modification_structure_english,
            modification_material_english,
            sketch_style_analysis_english,
          } = aiIdea;

          suggestions_english = `I will provide design suggestions from three different aspects:\n\n1. Function: ${modification_function_english}\n2. Structure: ${modification_structure_english}\n3. Material: ${modification_material_english}`;

          analysis_english = `Analysis of sketch style: ${sketch_style_analysis_english}\n\nTarget User: ${target_user_english}\n\nKey User Need: ${key_user_need_english}`;

          feedback = {
            type: "text",
            suggestions: suggestions_english,
            analysis: analysis_english,
          };
        } catch (error) {
          console.error("文字回饋生成錯誤:", error);
          feedback = {
            type: "text",
            suggestions:
              "Text feedback generation failed. The AI might not have understood the image. Please try again later.",
            analysis: error.message,
          };
        }
        break;

      case "sketch-image":
        if (!imageFile) {
          return NextResponse.json(
            { error: "Missing image file for sketch-image feedback." },
            { status: 400 }
          );
        }
        try {
          const ideationModel = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
          });
          const imagePart = {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: imageFile.type,
            },
          };

          const ideationResult = await ideationModel.generateContent([
            { text: sharedIdeationPrompt },
            imagePart,
          ]);
          const ideationResponseText = ideationResult.response.text();

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

          const {
            modification_function_english,
            modification_structure_english,
            modification_material_english,
            sketch_style_analysis_english,
          } = aiIdea;

          // ✨ 將三個建議合併成一個 Prompt
          const combined_modification_idea = `Integrate the following three changes into the base sketch: 1. Function: ${modification_function_english}. 2. Structure: ${modification_structure_english}. 3. Material: ${modification_material_english}.`;

          const imageGenModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-image-preview",
          });

          const executionTextPrompt = `Act as a skilled sketch artist who perfectly mimics other styles.
          
          **Image Constraints:** The final image should be highly compressed, with a file size under 1MB and a maximum resolution of 512x512 pixels. The style should remain consistent.
          
          **Target Style to Replicate:**
          You MUST perfectly replicate the original's hand-drawn style as described here: "${sketch_style_analysis_english}". The perspective, composition, and line quality must be identical. The final image should look like it was drawn by the same person who created the original sketch.
          
          **Required Modification:**
          ${combined_modification_idea}`;

          const executionPromptParts = [
            { text: executionTextPrompt },
            imagePart,
          ];

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
          const image_data_url = `data:${mimeType};base64,${base64ImageData}`;

          analysis_english = `I will provide design suggestions from three different aspects:
          1. Function: ${modification_function_english}
          2. Structure: ${modification_structure_english}
          3. Material: ${modification_material_english}`;

          feedback = {
            type: "image",
            suggestions: image_data_url,
            analysis: analysis_english,
          };
        } catch (error) {
          console.error("圖像生成錯誤:", error);
          feedback = {
            type: "text",
            suggestions:
              "Image generation failed. The AI might not have understood the image or generated a valid idea. Please try again later.",
            analysis: error.message,
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
              content: `You are a professional design mentor. Please provide creative ideation suggestions based on the design task.`,
            },
            {
              role: "user",
              content: `Design task: ${taskDescription}. Please provide creative ideation and design suggestions for this task, responding in plain text.`,
            },
          ],
        });
        suggestions_english =
          taskTextResponse.choices?.[0]?.message?.content || "";
        feedback = {
          type: "text",
          suggestions: suggestions_english,
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
              content: `You are a professional design mentor. Based on the design task, create a visualized design suggestion. Please describe a great design solution that meets the task's needs, including specific visual features, functional elements, and material textures, to be used for generating a reference image. Respond ONLY in English.`,
            },
            {
              role: "user",
              content: `Design task: ${taskDescription}. Please describe a great design solution for this task, including specific visual features, functional elements, and material textures, to be used for generating a reference image. Respond ONLY in English.`,
            },
          ],
        });
        analysis_english =
          taskImageResponse.choices?.[0]?.message?.content || "";

        const dallEResponseForTask = await openai.images.generate({
          model: "dall-e-3",
          prompt: `Design concept for: ${taskDescription}. ${analysis_english}.`,
          size: "1024x1024",
          quality: "standard",
          n: 1,
        });
        feedback = {
          type: "image",
          suggestions: dallEResponseForTask.data[0].url,
          analysis: analysis_english,
        };
        break;

      default:
        return NextResponse.json(
          { error: "Invalid feedback type" },
          { status: 400 }
        );
    }

    const translationModel = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
    });

    const getTranslation = async (text, prompt) => {
      if (!text) return "";
      try {
        const result = await translationModel.generateContent({
          contents: [
            { role: "user", parts: [{ text: `${prompt}\n\n${text}` }] },
          ],
        });
        return result.response.text();
      } catch (error) {
        console.error("Translation API error:", error);
        return text;
      }
    };

    if (feedback.type === "text" && feedback.suggestions) {
      const translationPrompt =
        "Translate the following design feedback into professional Traditional Chinese. Preserve the original structure and formatting. Do not add any extra conversational text.";
      const translatedSuggestions = await getTranslation(
        feedback.suggestions,
        translationPrompt
      );

      const translatedAnalysis = await getTranslation(
        analysis_english,
        "Translate the following design analysis into professional Traditional Chinese. Preserve the original structure and formatting. Do not add any extra conversational text."
      );

      feedback.suggestions = translatedSuggestions;
      feedback.analysis = translatedAnalysis;
    }

    if (feedback.type === "image" && feedback.analysis) {
      const translationPrompt =
        "Translate the following design analysis into professional Traditional Chinese. Preserve the original structure and formatting. Do not add any extra conversational text.";
      const translatedAnalysis = await getTranslation(
        analysis_english,
        translationPrompt
      );

      const chineseAnalysis = translatedAnalysis.replace(
        /\*\*(.*?)\*\*/g,
        (match, p1) => `${p1}`
      );
      feedback.analysis = chineseAnalysis;
    }

    return NextResponse.json({ feedback }, { status: 200 });
  } catch (error) {
    console.error("API 回饋錯誤：", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
