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

    const sharedIdeationPrompt_sketch = `You are an expert in avant-garde industrial design and ergonomic theory for long-term care facilities.
          
          **Context:**
          ${taskDescription}
          ${targetUser ? `**Target User:** ${targetUser}` : ''}
          ${userNeed ? `**Key User Need:** ${userNeed}` : ''}

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

    const sharedIdeationPrompt_task = `You are an expert in avant-garde industrial design and ergonomic theory for long-term care facilities.
          Analyze the general design context: "${taskDescription}".

          Your tasks are:
          1.  **Define a specific Target User and their Key Need** based on the context.
          2.  **Based on the User and Need you just defined**, provide ONE abstract design concept, described from THREE aspects (Structure, Form, Materiality), in **Traditional Chinese**.
          
          Use rich, descriptive adjectives. Be analytical and conceptual. AVOID overly literary language.
          
          Respond ONLY with a valid JSON object in the following format:
          {
            "defined_target_user_chinese": "A specific user persona you have defined (e.g., '行動不便的長者').",
            "defined_user_need_chinese": "A critical user need you have identified for them (e.g., '需要輕鬆進出椅子').",
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
      let prompt = isSketchMode
        ? sharedIdeationPrompt_sketch
        : sharedIdeationPrompt_task;

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

            Style: **loose, gestural sketch with multiple overlapping and rough, expressive lines.** Show clear evidence of **thinking on paper**, with dynamic and imperfect forms. Include **light, quick marker rendering** to suggest volume and shadow, but maintain a raw, unrefined aesthetic.
            AVOID clean CAD renders, precise line art, or finished presentation drawings. The image must look like a designer's initial, hurried ideation sketch.
          `;
        } else {
          // task-image 模式維持原樣
          imageGenerationPrompt = `
            A conceptual design sketch of a chair for a long-term care facility, specifically designed for a user who is "${aiIdea.defined_target_user_chinese}" with a need for "${aiIdea.defined_user_need_chinese}".
            The design should embody the feeling of "${aiIdea.concept_structure_chinese}".
            It should explore the idea of "${aiIdea.concept_form_chinese}".
            The materials should evoke a sense of "${aiIdea.concept_materiality_chinese}".

            Style: **loose, gestural sketch with multiple overlapping and rough, expressive lines.** Show clear evidence of **thinking on paper**, with dynamic and imperfect forms. Include **light, quick marker rendering** to suggest volume and shadow, but maintain a raw, unrefined aesthetic.
            AVOID clean CAD renders, precise line art, or finished presentation drawings. The image must look like a designer's initial, hurried ideation sketch.
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
          You are a creative industrial designer at a top design firm. Your primary role is to identify future potential in early concepts.
          Your tone must be direct, and analytical, yet collaborative and forward-looking.

          **Your response MUST follow this structure: 30% thesis, 70% opportunities/novel ideas.**

          1.  **(30%) Thesis:** Begin with a **brief, one-sentence summary** of the core design thesis that emerges from these concepts.
          2.  **(70%) Opportunities & Novel Ideas:** Dedicate the majority of your response to **generating innovative ideas** for the next iteration.Your feedback should be precise , simple and inspiring.

          Do not use overly flattering or subjective phrases. Focus on the potential of the new concepts. 
          The entire response must be in **Traditional Chinese** and be provided in a paragraph, **with a maximum of 300 characters**.
          Remove markdown syntax.
          

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
          You are a creative industrial designer at a top design firm. Your primary role is to identify future potential in early concepts.
          Your tone must be direct, and analytical, yet collaborative and forward-looking.

          **Your response MUST follow this structure: 30% user focus, 70% opportunities/novel ideas.**

          1.  **(30%) User Focus:** Begin by briefly stating the **specific user and need** you have identified. For example: "為了提供你多樣靈感，我定義了針對 [您定義的用戶], 他們的需求在於 [您定義的需求]..."
          2.  **(70%) Opportunities & Novel Ideas:** Based on that user focus, generate **innovative ideas** for a design concept. Your feedback should be precise, simple and inspiring.

          Do not use overly flattering or subjective phrases. Focus on the potential of the new concepts.
          The entire response must be in **Traditional Chinese** and be provided in a single paragraph, **with a maximum of 300 characters**.
          Remove markdown syntax.
          

          - Defined Target User: "${aiIdea.defined_target_user_chinese}"
          - Defined User Need: "${aiIdea.defined_user_need_chinese}"
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
