// upload.js 檔案
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * Uploads an image blob to Firebase Storage with a structured path.
 * @param {Blob} blob The image data to upload.
 * @param {string} participantId The ID of the test subject.
 * @param {number} sketchIndex The sequential index of the sketch for this subject.
 * @param {string} sketchType A descriptor for the sketch type (e.g., 'user_sketch', 'ai_suggestion').
 * @returns {Promise<string|null>} The download URL of the uploaded image, or null on failure.
 */
export async function uploadImage(blob, participantId, sketchIndex, sketchType, feedbackMode) {
  try {
    if (!participantId || sketchIndex === undefined || !sketchType || !feedbackMode) {
      throw new Error("Participant ID, sketch index, sketch type, and feedback mode are required for upload.");
    }
    const storage = getStorage();
    // Using ISO string for a sortable and unique timestamp, replacing characters that are invalid in some file systems.
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    // Pad the sketchIndex for better sorting (e.g., 001, 002, ...)
    const paddedIndex = String(sketchIndex).padStart(3, '0');
    const fileName = `${participantId}_${paddedIndex}_${sketchType}_${timestamp}.png`;
    const filePath = `sketches/${feedbackMode}_${participantId}/${fileName}`;

    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, blob);
    const imageUrl = await getDownloadURL(snapshot.ref);
    console.log(`Image uploaded to: ${filePath}`);
    return imageUrl;
  } catch (error) {
    console.error("圖片上傳到 Firebase Storage 失敗:", error);
    return null;
  }
}

export async function createParticipantInfo(participantId, selectedMode) {
  try {
    const docRef = await addDoc(collection(db, "participants"), {
      participantId: participantId,
      selectedMode: selectedMode,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("寫入受試者資訊到 Firestore 失敗:", error);
    throw new Error(`建立受試者資訊失敗: ${error.message}`);
  }
}

export async function uploadSketchAndFeedback(
  blob,
  participantId,
  sketchIndex, // <-- New parameter
  taskDescription,
  feedback,
  feedbackMode,
  targetUser, // <-- Add targetUser
  userNeed // <-- Add userNeed
) {
  try {
    if (!feedback) {
      throw new Error("無效的 AI 回饋資料。");
    }

    // Pass participantId and sketchIndex to uploadImage
    const userSketchUrl = await uploadImage(blob, participantId, sketchIndex, 'user_sketch', feedbackMode);
    if (!userSketchUrl) {
      throw new Error("無法上傳使用者草圖圖片。");
    }

    let aiSuggestionsUrl = "";
    let aiAnalysis = null;

    if (feedback.type === "image") {
      const base64Image = feedback.suggestions;
      if (base64Image) {
        const cleanedBase64 = base64Image.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        if (!cleanedBase64 || cleanedBase64.length === 0) {
          throw new Error("無效的 Base64 字串");
        }
        const buffer = Buffer.from(cleanedBase64, "base64");
        const aiImageBlob = new Blob([buffer], { type: "image/png" });
        // Pass participantId and sketchIndex for the AI image as well
        aiSuggestionsUrl = await uploadImage(aiImageBlob, participantId, sketchIndex, 'ai_suggestion', feedbackMode);
        if (!aiSuggestionsUrl) {
          throw new Error("無法上傳 AI 回饋圖片。");
        }
      }
      aiAnalysis = JSON.stringify(feedback.analysis || {});
    } else if (feedback.type === "text") {
      aiAnalysis = JSON.stringify(feedback.analysis || {});
      aiSuggestionsUrl = "";
    }

    const recordData = {
      participantId: participantId,
      sketchIndex: sketchIndex, // Also save index to the record
      taskDescription: taskDescription,
      userSketchUrl: userSketchUrl,
      aiFeedbackSuggestionsUrl: aiSuggestionsUrl,
      aiFeedbackSuggestions: aiAnalysis,
      feedbackMode: feedbackMode,
      targetUser: targetUser, // <-- Save targetUser
      userNeed: userNeed, // <-- Save userNeed
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "feedbackRecords"), recordData);
    return { recordData, userSketchUrl, docId: docRef.id };
  } catch (error) {
    console.error("上傳失敗：", error);
    throw new Error(`上傳失敗: ${error.message}`);
  }
}
