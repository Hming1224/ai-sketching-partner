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

    const sharedIdeationPrompt_sketch = `You are a kind and experienced design professor guiding a student. Your goal is to offer insightful observations to help them see new possibilities in their work.
          Your primary task is not to describe the user's sketch, but to use it as inspiration to generate a **clear, actionable, and inspirational conceptual direction**.

          **Context:**
          - The user's sketch and design context is for: "${taskDescription}".
          - ${targetUser ? `Target User: ${targetUser}` : ""}
          - ${userNeed ? `Key User Need: ${userNeed}` : ""}

          **Your two-step task, in Traditional Chinese:**
          1.  **Step 1: Generate Distinct Building Blocks.** Based on the user's sketch, generate three **distinct and different** new, concrete concepts for its potential evolution.
          2.  **Step 2: Synthesize into a Constructive Narrative.** Weave the three concepts you just generated in Step 1 into a single, flowing paragraph. This paragraph is your **constructive suggestion** for the user's next iteration.

          **IMPORTANT RULES:**
          - Provide constructive feedback with appropriate and moderate encouragement. Avoid excessive praise.
          - Each of the three concepts (structure, form, materiality) must be distinct and explore a different direction.
          - Use simple, everyday, and easy-to-understand adjectives focusing on form, texture, and ergonomics. (e.g., instead of 'volumetric', say 'full and rounded'; instead of 'tectonic', say 'clearly structured').
          - Be insightful and practical. AVOID overly abstract, academic, or metaphorical language.
          - 請使用口語、白話、親切自然的台灣正體中文來提供建議，就像在和設計系的同學輕鬆地對話一樣。
          - DO NOT provide any color-related suggestions.
          - DO NOT use Markdown syntax, titles, or lists in your response.

          Respond ONLY with a valid JSON object in the following format:
          {
            "concept_structure_chinese": "A **concrete suggestion** for the chair's supportive quality, using simple adjectives.",
            "concept_form_chinese": "A **clear new direction** for the shapes and their relationships, using simple adjectives.",
            "concept_materiality_chinese": "An **easy-to-imagine idea** for the sensory experience of the materials, using simple adjectives.",
            "narrative_feedback_chinese": "A **constructive and insightful suggestion** that synthesizes the three concepts above into a single, forward-looking paragraph of approximately 200 characters in Traditional Chinese. This should guide the user on how they could evolve their design."
          }`;

    const sharedIdeationPrompt_task = `You are an expert in avant-garde industrial design and ergonomic theory for long-term care facilities, with a talent for imagining unique user stories.
          Analyze the general design context: "${taskDescription}".

          Your tasks are:
          1.  **Invent a creative and specific Target User and their Key Need within the context of a long-term care center.** This is the most important step. Your goal is to inspire the designer with a fresh perspective.
          2.  **Based on the User and Need you just invented**, provide ONE abstract design concept, described from THREE aspects (Structure, Form, Materiality), in **Traditional Chinese**.
          
          **IMPORTANT RULES for defining the user:**
          - **STRICT CONTEXT: The user and need MUST be plausible and directly related to the daily life, challenges, or activities within a long-term care facility (e.g., the elderly, caregivers, family visitors).**
          - **LENGTH: 
            defined_target_user_chinese and defined_user_need_chinese MUST each be UNDER 20 characters.**

          Use rich, descriptive adjectives. Be analytical and conceptual. AVOID overly literary language.
          - 請使用口語、白話、親切自然的台灣正體中文來提供建議，就像在和設計系的學弟妹輕鬆地對話一樣。避免生硬、學術或過於抽象的詞彙。
          - DO NOT provide any color-related suggestions.
          
          Respond ONLY with a valid JSON object in the following format:
          {
            "defined_target_user_chinese": "A creative, specific user persona (UNDER 40 CHARACTERS).",
            "defined_user_need_chinese": "A critical and specific user need for them (UNDER 40 CHARACTERS).",
            "concept_structure_chinese": "An adjective-rich description of the chair's supportive quality, tailored to the defined user in Traditional Chinese.",
            "concept_form_chinese": "A description of the abstract geometric forms, tailored to the defined user in Traditional Chinese.",
            "concept_materiality_chinese": "A sensory description of the materials, tailored to the defined user in Traditional Chinese.",
            "narrative_feedback_chinese": "A single, flowing paragraph in Traditional Chinese (approx. 200 characters). It MUST start with the EXACT phrase: '我設定的目標受眾是 [The user you just defined], 他們的需求是 [The need you just defined]。根據以上資訊，我們可以從幾個方向來發想，' and then continue by proposing new, innovative solutions based on the Design DNA. Be descriptive and imaginative; DO NOT use lists or titles."
          }`;

    const getAiIdeation = async (prompt, isSketchMode, imagePart) => {
      const MAX_RETRIES = 3;
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          const ideationModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash", // Reverting to the more stable model
          });
          // [核心修正一] 將傳送的內容包裹成 SDK 要求的標準格式
          const parts = [{ text: prompt }];
          if (isSketchMode && imagePart) {
            parts.push(imagePart);
          }
          const result = await ideationModel.generateContent({
            contents: [{ role: "user", parts: parts }],
          });
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
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          // For other errors or if retries are exhausted, throw a final error
          throw new Error(
            `AI Ideation API call failed after ${
              i + 1
            } attempts. Please check the API key and network connection.`
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
          - **STRICT CONTEXT: The user and need MUST be plausible and directly related to the daily life, challenges, or activities within a long-term care facility (e.g., the elderly, caregivers, family visitors).**
          - **YOU MUST NOT REPEAT or create a similar persona to the ones listed under "PREVIOUSLY USED PERSONAS".** This is a hard rule.
          - **LENGTH: defined_target_user_chinese and defined_user_need_chinese MUST each be UNDER 40 characters.**
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
            "concept_materiality_chinese": "A sensory description of the materials, tailored to the new user in Traditional Chinese.",
            "narrative_feedback_chinese": "A single, flowing paragraph in Traditional Chinese (approx. 200 characters). It MUST start with the EXACT phrase: '在長照中心的設計任務之下，我想試著從一個不同的角度來切入，給你參考看看。我設定了 [The user you just invented] 這個目標受眾，他們的需求是 [The need you just identified]。基於這個情境，我的想法是...' and then continue by proposing new, innovative solutions based on the Design DNA. Be descriptive and imaginative; DO NOT use lists or titles."
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
                  **Core Task:** You are a visionary designer tasked with radically reinterpreting a user's sketch. Your goal is to produce a new concept that is **bold, unexpected, and pushes the boundaries** of the original idea.

                  - **Deconstruct and Exaggerate:** Don't just transform the sketch, deconstruct it. Identify its most interesting feature—a curve, a joint, an angle—and **exaggerate it dramatically**.
                  - **Radical Reinterpretation:** Use the user's sketch as a faint echo, not a foundation. Your output should be a **visually provocative evolution** that challenges the initial concept. Blend the core essence with the new conceptual ideas below in a way that feels entirely new.

                  **New Conceptual Ideas:**
                  - The main form is defined by its enclosing quality: "${aiIdea.concept_structure_chinese}".
                  - The overall volumetric shape is composed of: "${aiIdea.concept_form_chinese}".
                  - The surface and material properties should convey: "${aiIdea.concept_materiality_chinese}".

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
              // [核心修正二] 同樣地，將傳送的內容包裹成 SDK 標準格式
              const imageParts = [{ text: imageGenerationPrompt }];
              if (isSketchMode && imagePart) {
                // sketch-image 模式下傳入原始圖片
                imageParts.push(imagePart);
              }
              const imageGenResult = await imageGenModel.generateContent({
                contents: [{ role: "user", parts: imageParts }],
              });
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
                console.log(
                  `Image generation service unavailable, retrying in 2 seconds...`
                );
                await new Promise((resolve) => setTimeout(resolve, 2000));
                continue;
              }
              throw new Error(
                `Image generation failed after ${i + 1} attempts.`
              );
            }
          }
        })();
        promises.push(
          imageGenerationPromise.then((url) => {
            suggestions_url = url;
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
        type: feedbackType.includes("image") ? "image" : "text",
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
