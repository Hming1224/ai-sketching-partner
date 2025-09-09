// upload.js 檔案
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadImage(blob) {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, `sketches/${Date.now()}.png`);
    const snapshot = await uploadBytes(storageRef, blob);
    const imageUrl = await getDownloadURL(snapshot.ref);
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
  taskDescription,
  feedback,
  feedbackMode
) {
  try {
    if (!feedback) {
      throw new Error("無效的 AI 回饋資料。");
    }

    const userSketchUrl = await uploadImage(blob);
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
        aiSuggestionsUrl = await uploadImage(aiImageBlob);
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
      taskDescription: taskDescription,
      userSketchUrl: userSketchUrl,
      aiFeedbackSuggestionsUrl: aiSuggestionsUrl,
      aiFeedbackSuggestions: aiAnalysis,
      feedbackMode: feedbackMode,
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "feedbackRecords"), recordData);
    return { recordData, userSketchUrl, docId: docRef.id };
  } catch (error) {
    console.error("上傳失敗：", error);
    throw new Error(`上傳失敗: ${error.message}`);
  }
}
