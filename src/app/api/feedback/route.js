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

    const previousPersonasRaw = formData.get("previousPersonas");
    let previousPersonas = [];
    if (previousPersonasRaw) {
      try {
        previousPersonas = JSON.parse(previousPersonasRaw);
      } catch (e) {
        console.error("Failed to parse previousPersonas:", e);
      }
    }

    let buffer;
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    let feedback;
    let aiIdea = {};

    const sharedIdeationPrompt_sketch = `You are an expert in avant-garde industrial design and ergonomic theory for long-term care facilities.
          
          **Context:**
          ${taskDescription}
          ${targetUser ? `**Target User:** ${targetUser}` : ""}
          ${userNeed ? `**Key User Need:** ${userNeed}` : ""}

          Analyze the user's sketch and design context above, your task is to provide ONE abstract concept, described from THREE aspects, in **Traditional Chinese**.
          
          **IMPORTANT RULE:** 
          - Use rich, descriptive adjectives focusing on form, texture, and ergonomics.
          - Be analytical ,conceptual , and inspirational. AVOID overly literary or metaphorical language.
          - DO NOT provide any color-related suggestions.
          - DO NOT use Markdown syntax, titles, or lists in your response.
          
          Respond ONLY with a valid JSON object in the following format:
          {
            "concept_structure_chinese": "An adjective-rich description of the chair's supportive and enclosing quality in Traditional Chinese.",
            "concept_form_chinese": "A description of the abstract geometric forms, their relationships, and the overall volumetric presence in Traditional Chinese.",
            "concept_materiality_chinese": "A description of the sensory experience of the materials, focusing on texture, temperature, and finish in Traditional Chinese."
          }`;

    const sharedIdeationPrompt_task = `You are an expert in avant-garde industrial design and ergonomic theory for long-term care facilities, with a talent for imagining unique user stories.
          Analyze the general design context: "${taskDescription}".

          Your tasks are:
          1.  **Invent a creative and specific Target User and their Key Need within the context of a long-term care center.** This is the most important step. Your goal is to inspire the designer with a fresh perspective.
          2.  **Based on the User and Need you just invented**, provide ONE abstract design concept, described from THREE aspects (Structure, Form, Materiality), in **Traditional Chinese**.
          
          **IMPORTANT RULES for defining the user:**
          - **LENGTH: 
            defined_target_user_chinese and defined_user_need_chinese MUST each be UNDER 20 characters.**
          - **ENSURE the user and need are directly related.**

          Use rich, descriptive adjectives. Be analytical and conceptual. AVOID overly literary language.
          - DO NOT provide any color-related suggestions.
          
          Respond ONLY with a valid JSON object in the following format:
          {
            "defined_target_user_chinese": "A creative, specific user persona (UNDER 20 CHARACTERS).",
            "defined_user_need_chinese": "A critical and specific user need for them (UNDER 20 CHARACTERS).",
            "concept_structure_chinese": "An adjective-rich description of the chair's supportive quality, tailored to the defined user in Traditional Chinese.",
            "concept_form_chinese": "A description of the abstract geometric forms, tailored to the defined user in Traditional Chinese.",
            "concept_materiality_chinese": "A sensory description of the materials, tailored to the defined user in Traditional Chinese."
          }`;

    const getAiIdeation = async (prompt, isSketchMode, imagePart) => {
      const MAX_RETRIES = 6;
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          const ideationModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash", // Reverting to the more stable model
          });
          const content =
            isSketchMode && imagePart ? [prompt, imagePart] : [prompt];
          const result = await ideationModel.generateContent(content);
          const responseText = result.response.text();

          // If successful, parse and return the JSON
          const match = responseText.match(/\{.*\}/s);
          if (!match) {
            throw new Error("No JSON object found in the response.");
          }
          const cleanedJsonText = match[0];
          return JSON.parse(cleanedJsonText);

        } catch (e) {
          console.error(`Gemini API call attempt ${i + 1} failed:`, e);
          // If it's a 503 error and we have retries left, wait and continue
          if (e.status === 503 && i < MAX_RETRIES - 1) {
            console.log(`Service unavailable, retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          // For other errors or if retries are exhausted, throw a final error
          throw new Error(
            `AI Ideation API call failed after ${i + 1} attempts. Please check the API key and network connection.`
          );
        }
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
      let prompt;
      if (isSketchMode) {
        prompt = sharedIdeationPrompt_sketch;
      } else {
        const previousPersonasString =
          previousPersonas.length > 0
            ? `
          **PREVIOUSLY USED PERSONAS (DO NOT REPEAT THESE):**\n${previousPersonas
            .map((p) => `          - User: ${p.user}, Need: ${p.need}`)
            .join("\n")}`
            : "";

        prompt = `You are an expert in avant-garde industrial design and ergonomic theory for long-term care facilities, with a talent for imagining unique user stories.
          Analyze the general design context: \"${taskDescription}\".
          ${previousPersonasString}

          Your tasks are:
          1.  **Invent a COMPLETELY NEW and specific Target User and their Key Need within the context of a long-term care center.** This is the most important step. Your goal is to inspire the designer with a fresh perspective that is DIFFERENT from all previous ones.
          2.  **Based on the User and Need you just invented**, provide ONE abstract design concept, described from THREE aspects (Structure, Form, Materiality), in **Traditional Chinese**.
          
          **ABSOLUTE CRITICAL RULES for defining the user:**
          - **YOU MUST NOT REPEAT or create a similar persona to the ones listed under "PREVIOUSLY USED PERSONAS".** This is a hard rule.
          - **LENGTH: defined_target_user_chinese and defined_user_need_chinese MUST each be UNDER 20 characters.**
          - **ENSURE the user and need are directly related.**
          - **DO NOT use Markdown syntax, titles, or lists in your response.**

          Use rich, descriptive adjectives. Be analytical and conceptual. AVOID overly literary language.
          - DO NOT provide any color-related suggestions.
          
          Respond ONLY with a valid JSON object in the following format:
          {
            "defined_target_user_chinese": "A creative, specific, and COMPLETELY NEW user persona you have invented.",
            "defined_user_need_chinese": "A critical and specific user need you have identified for them, which has not been addressed before.",
            "concept_structure_chinese": "An adjective-rich description of the chair's supportive quality, tailored to the new user in Traditional Chinese.",
            "concept_form_chinese": "A description of the abstract geometric forms, tailored to the new user in Traditional Chinese.",
            "concept_materiality_chinese": "A sensory description of the materials, tailored to the new user in Traditional Chinese."
          }`;
      }

      aiIdea = await getAiIdeation(prompt, isSketchMode, imagePart);

      let finalAnalysis = { ...aiIdea };
      let suggestions_url = null;

      // --- PARALLEL EXECUTION START ---

      const promises = [];

      // Promise for Image Generation
      if (feedbackType === "sketch-image" || feedbackType === "task-image") {
        const imageGenerationPromise = (async () => {
          const MAX_RETRIES = 6;
          for (let i = 0; i < MAX_RETRIES; i++) {
            try {
              let imageGenerationPrompt;
              if (feedbackType === "sketch-image") {
                imageGenerationPrompt = `
                  A conceptual form study of a chair, presented as an **exploratory industrial design sketch**.
                  The main form is defined by its enclosing quality: "${aiIdea.concept_structure_chinese}".
                  The overall volumetric shape is composed of: "${aiIdea.concept_form_chinese}".
                  The surface and material properties should convey: "${aiIdea.concept_materiality_chinese}".

                  **Style:** The sketch must look like a rapid, early-stage brainstorming drawing.
                  - Use **sketchy, unrefined, and multiple overlapping lines** to build up the form.
                  - Include **rough, gestural cross-hatching and quick, minimal marker shading**.
                  - The overall aesthetic should be dynamic, raw, and energetic.

                  **ABSOLUTE RULES FOR IMAGE CONTENT:**
                  - The image MUST contain ONLY the single chair sketch.
                  - The background MUST be a completely plain, neutral, solid white.
                  - ZERO TEXT: Do not add any text, letters, numbers, annotations, titles, or watermarks anywhere in the image.
                  - ZERO EXTRA OBJECTS: Do not add any arrows, measurements, notes, people, or any other objects. The image must be clean.
                  - AVOID a polished, finished look. The style must be a rough, exploratory sketch.
                `;
              } else {
                imageGenerationPrompt = `
                  A conceptual design sketch of a chair for "${aiIdea.defined_target_user_chinese}" needing "${aiIdea.defined_user_need_chinese}".
                  The design should embody "${aiIdea.concept_structure_chinese}", explore "${aiIdea.concept_form_chinese}", and use materials evoking "${aiIdea.concept_materiality_chinese}".

                  **Style:** The sketch must look like a rapid, early-stage brainstorming drawing.
                  - Use **sketchy, unrefined, and multiple overlapping lines**.
                  - Include **rough, gestural cross-hatching and quick, minimal marker shading**.
                  - The overall aesthetic should be dynamic, raw, and energetic.

                  **ABSOLUTE RULES FOR IMAGE CONTENT:**
                  - The image MUST contain ONLY the single chair sketch.
                  - The background MUST be a completely plain, neutral, solid white.
                  - ZERO TEXT: Do not add any text, letters, numbers, annotations, titles, or watermarks anywhere in the image.
                  - ZERO EXTRA OBJECTS: Do not add any arrows, measurements, notes, people, or any other objects. The image must be clean.
                  - AVOID a polished, finished look. The style must be a rough, exploratory sketch.
                `;
              }

              const imageGenModel = genAI.getGenerativeModel({
                model: "gemini-2.5-flash-image-preview",
              });
              const imageGenResult = await imageGenModel.generateContent([
                { text: imageGenerationPrompt },
              ]);
              const imagePartResponse =
                imageGenResult.response.candidates?.[0]?.content?.parts?.find(
                  (p) => p.inlineData
                );
              if (!imagePartResponse) {
                throw new Error("Gemini (Image Gen) did not return an image.");
              }
              return `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`;
            } catch (e) {
              console.error(`Image generation attempt ${i + 1} failed:`, e);
              if (e.status === 503 && i < MAX_RETRIES - 1) {
                console.log(`Image generation service unavailable, retrying in 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              throw new Error(`Image generation failed after ${i + 1} attempts.`);
            }
          }
        })();
        promises.push(
          imageGenerationPromise.then((url) => {
            suggestions_url = url;
          })
        );
      }

      // Promise for Narrative Synthesis
      if (aiIdea.concept_structure_chinese) {
        const narrativePromise = (async () => {
          let synthesisPrompt;
          if (isSketchMode) {
            synthesisPrompt = `
              You are a creative design partner. Your goal is to provide gentle, thought-provoking feedback to a designer in a conversational, encouraging tone.
              **Task:** Summarize the core essence of the design concepts and then propose new, innovative solutions that build upon them.
              
              **Output Rules (VERY IMPORTANT):**
              - **LANGUAGE: Your entire response MUST be in Traditional Chinese ONLY. Do not use any other languages.**
              - The entire response must be a single, flowing paragraph of approximately 200 characters.
              - **DO NOT use lists or titles.**
              - Be descriptive and imaginative, using rich, practical adjectives.

              **Design DNA:**
              - Structure: "${aiIdea.concept_structure_chinese}"
              - Form: "${aiIdea.concept_form_chinese}"
              - Materiality: "${aiIdea.concept_materiality_chinese}"
            `;
          } else {
            synthesisPrompt = `
          You are a creative and inspiring design partner. Your goal is to provide gentle, thought-provoking feedback to a designer. Your tone should be natural, conversational, and encouraging.

          **Your Task:**
          1.  Start your response with the EXACT phrase: "我設定的目標受眾是 ${aiIdea.defined_target_user_chinese}，他們的需求是 ${aiIdea.defined_user_need_chinese}。根據以上資訊，我們可以從幾個方向來發想，"
          2.  Continue from that phrase to propose new, innovative solutions based on the Design DNA below.
          3.  The entire response must be a single, flowing paragraph.

          **Style Guidelines:**
          - Be descriptive and imaginative, using rich, practical adjectives.
          - DO NOT use lists, bullet points, or any kind of "一、", "二、" titles.

          **Output Rules (VERY IMPORTANT):**
          - **LANGUAGE: Your entire response MUST be in Traditional Chinese ONLY. Do not use any other languages.**
          - **NOVELTY: Your proposed solutions MUST be creative and distinct. Avoid repeating previous suggestions or generic advice.**
          - **LENGTH: The TOTAL character count of your response should be approximately 200 characters.**

          **Design DNA to inspire new solutions:**
          - Concept of Structure: "${aiIdea.concept_structure_chinese}"
          - Concept of Form: "${aiIdea.concept_form_chinese}"
          - Concept of Materiality: "${aiIdea.concept_materiality_chinese}"
        `;
          }
          const synthesisModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
          });
          const synthesisResult = await synthesisModel.generateContent(
            synthesisPrompt
          );
          return synthesisResult.response.text().trim();
        })();
        promises.push(
          narrativePromise.then((narrative) => {
            finalAnalysis.narrative_feedback_chinese = narrative;
          })
        );
      }

      await Promise.all(promises);

      // --- PARALLEL EXECUTION END ---

      feedback = {
        type: feedbackType.includes("image") ? "image" : "text",
        suggestions: suggestions_url,
        analysis: finalAnalysis,
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
