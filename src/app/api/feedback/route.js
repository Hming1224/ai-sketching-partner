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
          
          Respond ONLY with a valid JSON object in the following format:
          {
            "concept_structure_chinese": "An adjective-rich description of the chair's supportive and enclosing quality in Traditional Chinese.",
            "concept_form_chinese": "A description of the abstract geometric forms, their relationships, and the overall volumetric presence in Traditional Chinese.",
            "concept_materiality_chinese": "A description of the sensory experience of the materials, focusing on texture, temperature, and finish in Traditional Chinese."
          }`;

    const sharedIdeationPrompt_task = `You are an expert in avant-garde industrial design and ergonomic theory for long-term care facilities, with a talent for imagining unique user stories.
          Analyze the general design context: "${taskDescription}".

          Your tasks are:
          1.  **Invent a creative and specific Target User and their Key Need.** This is the most important step. Your goal is to inspire the designer with a fresh perspective.
          2.  **Based on the User and Need you just invented**, provide ONE abstract design concept, described from THREE aspects (Structure, Form, Materiality), in **Traditional Chinese**.
          
          **IMPORTANT RULES for defining the user:**
          - **DO NOT be generic.** Avoid obvious personas like '行動不便的長者' or '普通的老人'.
          - **BE CREATIVE.** Invent a specific character. For example: '一位喜歡在窗邊閱讀報紙的退休校長' or '一位因關節炎而難以長時間維持同一姿勢的奶奶'.
          - **ENSURE the user and need are directly related.**

          Use rich, descriptive adjectives. Be analytical and conceptual. AVOID overly literary language.
          
          Respond ONLY with a valid JSON object in the following format:
          {
            "defined_target_user_chinese": "A creative, specific user persona you have invented.",
            "defined_user_need_chinese": "A critical and specific user need you have identified for them.",
            "concept_structure_chinese": "An adjective-rich description of the chair's supportive quality, tailored to the defined user in Traditional Chinese.",
            "concept_form_chinese": "A description of the abstract geometric forms, tailored to the defined user in Traditional Chinese.",
            "concept_materiality_chinese": "A sensory description of the materials, tailored to the defined user in Traditional Chinese."
          }`;

    const getAiIdeation = async (prompt, isSketchMode, imagePart) => {
      let responseText;
      try {
        const ideationModel = genAI.getGenerativeModel({
          model: "gemini-1.5-pro-latest",
        });
        const content =
          isSketchMode && imagePart ? [prompt, imagePart] : [prompt];
        const result = await ideationModel.generateContent(content);
        responseText = result.response.text();
      } catch (e) {
        console.error("Gemini API call failed:", e);
        throw new Error(
          "AI Ideation API call failed. Please check the API key and network connection."
        );
      }

      try {
        // [修改二] 現在兩種模式都回傳 JSON，所以不再需要 else 判斷
        const match = responseText.match(/\{.*\}/s);
        if (!match) {
          throw new Error("No JSON object found in the response.");
        }
        const cleanedJsonText = match[0];
        return JSON.parse(cleanedJsonText);
      } catch (e) {
        console.error(
          "JSON/Text parsing error:",
          e.message,
          `\nAI Response:\n${responseText}`
        );
        throw new Error(
          `AI (Ideation) failed to return a valid structured response.`
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
      let prompt;
      if (isSketchMode) {
        prompt = sharedIdeationPrompt_sketch;
      } else {
        const previousPersonasString = previousPersonas.length > 0 
          ? `
          **PREVIOUSLY USED PERSONAS (DO NOT REPEAT THESE):**\n${previousPersonas.map(p => `          - User: ${p.user}, Need: ${p.need}`).join('\n')}`
          : '';

        prompt = `You are an expert in avant-garde industrial design and ergonomic theory for long-term care facilities, with a talent for imagining unique user stories.
          Analyze the general design context: \"${taskDescription}\".
          ${previousPersonasString}

          Your tasks are:
          1.  **Invent a COMPLETELY NEW and specific Target User and their Key Need.** This is the most important step. Your goal is to inspire the designer with a fresh perspective that is DIFFERENT from all previous ones.
          2.  **Based on the User and Need you just invented**, provide ONE abstract design concept, described from THREE aspects (Structure, Form, Materiality), in **Traditional Chinese**.
          
          **ABSOLUTE CRITICAL RULES for defining the user:**
          - **YOU MUST NOT REPEAT or create a similar persona to the ones listed under "PREVIOUSLY USED PERSONAS".** This is a hard rule.
          - **DO NOT be generic.** Avoid obvious personas like '行動不便的長者' or '普通的老人'.
          - **BE CREATIVE AND SPECIFIC.** Invent a unique character. For example: '一位喜歡在陽台種植盆栽的獨居爺爺' or '一位需要長時間進行復健訓練，但又希望椅子能融入家居環境的女士'.
          - **ENSURE the user and need are directly related.**

          Use rich, descriptive adjectives. Be analytical and conceptual. AVOID overly literary language.
          
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

      let suggestions_url = null;
      if (feedbackType === "sketch-image" || feedbackType === "task-image") {
        let imageGenerationPrompt;

        // [唯一的修改處] 將 sketch-image 模式的 Prompt 替換為更抽象的版本
        if (feedbackType === "sketch-image") {
          imageGenerationPrompt = `
            A conceptual form study of a chair, presented as an **exploratory industrial design sketch**.
            The main form is defined by its enclosing quality: "${aiIdea.concept_structure_chinese}".
            The overall volumetric shape is composed of: "${aiIdea.concept_form_chinese}".
            The surface and material properties should convey: "${aiIdea.concept_materiality_chinese}".

            **Style:** The sketch must look like a rapid, early-stage brainstorming drawing.
            - Use **sketchy, unrefined, and multiple overlapping lines** to build up the form. A single curve should be visibly composed of several searching strokes, showing the process of finding the right line.
            - Include **rough, gestural cross-hatching and quick, minimal marker shading** to hint at volume and material texture, not to create a realistic rendering.
            - The overall aesthetic should be dynamic, raw, and energetic.

            **Strict Rules:**
            - The image must **ONLY contain the chair sketch** on a plain, neutral (light gray or white) background.
            - **DO NOT add any text, annotations, arrows, measurements, notes, or any other objects** to the image.
            - AVOID clean, single-stroke "vector" lines, perfect geometric shapes, and a polished, finished look.
          `;
        } else {
          // task-image 模式維持原樣
          imageGenerationPrompt = `
            A conceptual design sketch of a chair for a long-term care facility, specifically designed for a user who is "${aiIdea.defined_target_user_chinese}" with a need for "${aiIdea.defined_user_need_chinese}".
            The design should embody the feeling of "${aiIdea.concept_structure_chinese}".
            It should explore the idea of "${aiIdea.concept_form_chinese}".
            The materials should evoke a sense of "${aiIdea.concept_materiality_chinese}".

            **Style:** The sketch must look like a rapid, early-stage brainstorming drawing.
            - Use **sketchy, unrefined, and multiple overlapping lines** to build up the form. A single curve should be visibly composed of several searching strokes, showing the process of finding the right line.
            - Include **rough, gestural cross-hatching and quick, minimal marker shading** to hint at volume and material texture, not to create a realistic rendering.
            - The overall aesthetic should be dynamic, raw, and energetic.

            **Strict Rules:**
            - The image must **ONLY contain the chair sketch** on a plain, neutral (light gray or white) background.
            - **DO NOT add any text, annotations, arrows, measurements, notes, or any other objects** to the image.
            - AVOID clean, single-stroke "vector" lines, perfect geometric shapes, and a polished, finished look.
          `;
        }

        console.log(
          "Final Prompt for Image Generation:",
          imageGenerationPrompt
        );

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
        suggestions_url = `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`;
      }

      // [核心修改] 新增文本整合步驟
      let finalAnalysis = { ...aiIdea };

      if (isSketchMode && aiIdea.concept_structure_chinese) {
        const synthesisPrompt = `
          You are a creative and inspiring design partner. Your goal is to provide gentle, thought-provoking feedback to a designer.
          Your tone should be natural, conversational, and encouraging, like talking to a creative peer.

          Your response MUST follow this structure:
          1.  **(20%) Current Design:** Briefly summarize the core essence of the current design concepts in one sentence.
          2.  **(80%) New Solutions:** Dedicate the rest of the response to proposing new, innovative solutions and possibilities that build upon the initial ideas.

          **Guidelines:**
          - Speak in **Traditional Chinese**.
          - The response must be a single, flowing paragraph.
          - **Strictly use between 150 and 200 characters.**
          - **DO NOT use numbered lists, bullet points, or any kind of "一、", "二、" titles.**
          - Maintain a highly descriptive and imaginative style, using plenty of rich adjectives to describe the feelings and forms.

          **Design DNA:**
          - Concept of Structure: "${aiIdea.concept_structure_chinese}"
          - Concept of Form: "${aiIdea.concept_form_chinese}"
          - Concept of Materiality: "${aiIdea.concept_materiality_chinese}"
        `;

        const synthesisModel = genAI.getGenerativeModel({
          model: "gemini-1.5-pro-latest",
        });
        const synthesisResult = await synthesisModel.generateContent(
          synthesisPrompt
        );
        const narrativeFeedback = synthesisResult.response.text();

        // 將整合後的文本加入到最終的 analysis 物件中
        finalAnalysis.narrative_feedback_chinese = narrativeFeedback.trim();
      } else if (!isSketchMode && aiIdea.concept_structure_chinese) {
        const taskSynthesisPrompt = `
          You are a creative and inspiring design partner. Your goal is to provide gentle, thought-provoking feedback to a designer.
          Your tone should be natural, conversational, and encouraging, like talking to a creative peer.

          Your response MUST start with the following sentence structure: "我設定的目標受眾是 ${aiIdea.defined_target_user_chinese}, 他們的用戶需求是 ${aiIdea.defined_user_need_chinese}，針對這類群體和其需求，我們可以從幾個方向來發想..."
          Then, continue by proposing new, innovative solutions and possibilities based on the design DNA.

          **Guidelines:**
          - Speak in **Traditional Chinese**.
          - The response must be a single, flowing paragraph.
          - **The final output must be strictly between 150 and 200 characters.**
          - **DO NOT use numbered lists, bullet points, or any kind of "一、", "二、" titles.**
          - Maintain a highly descriptive and imaginative style, using plenty of rich adjectives.

          **Design DNA to inspire new solutions:**
          - Concept of Structure: "${aiIdea.concept_structure_chinese}"
          - Concept of Form: "${aiIdea.concept_form_chinese}"
          - Concept of Materiality: "${aiIdea.concept_materiality_chinese}"
        `;

        const synthesisModel = genAI.getGenerativeModel({
          model: "gemini-1.5-pro-latest",
        });
        const synthesisResult = await synthesisModel.generateContent(
          taskSynthesisPrompt
        );
        const narrativeFeedback = synthesisResult.response.text();

        finalAnalysis.narrative_feedback_chinese = narrativeFeedback.trim();
      }

      feedback = {
        type: feedbackType.includes("image") ? "image" : "text",
        suggestions: suggestions_url,
        analysis: finalAnalysis, // 使用包含整合文本的 finalAnalysis
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
