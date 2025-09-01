// upload.js 檔案

import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// 這是一個示範用的 uploadImage 函式
export async function uploadImage(blob) {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, `sketches/${Date.now()}.png`);

    // 使用 uploadBytes 函式上傳 blob
    const snapshot = await uploadBytes(storageRef, blob);
    console.log("圖片已成功上傳。");

    // 取得圖片的公開 URL
    const imageUrl = await getDownloadURL(snapshot.ref);
    console.log("圖片 URL:", imageUrl);

    return imageUrl;
  } catch (error) {
    console.error("圖片上傳到 Firebase Storage 失敗:", error);
    return null;
  }
}

// createParticipantInfo 函式
export async function createParticipantInfo(participantId, selectedMode) {
  try {
    const docRef = await addDoc(collection(db, "participants"), {
      participantId: participantId,
      selectedMode: selectedMode,
      timestamp: serverTimestamp(),
    });
    console.log("受試者資訊已成功寫入 Firestore, ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("寫入受試者資訊到 Firestore 失敗:", error);
    throw new Error(`建立受試者資訊失敗: ${error.message}`);
  }
}

// uploadSketchAndFeedback 函式
export async function uploadSketchAndFeedback(
  blob,
  participantId,
  taskDescription,
  feedback,
  feedbackMode
) {
  try {
    if (!feedback || !feedback.suggestions) {
      throw new Error("無效的 AI 回饋資料。");
    }

    const userSketchUrl = await uploadImage(blob);
    if (!userSketchUrl) {
      throw new Error("無法上傳使用者草圖圖片。");
    }

    let aiSuggestionsUrl = "";
    let aiAnalysis = "";

    if (feedback.type === "image") {
      const base64Image = feedback.suggestions;

      // 🚨 修正：更穩健的 Base64 轉換方式
      // 移除前綴，只保留純粹的 Base64 數據
      const cleanedBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

      // 檢查清理後的字串是否為有效 Base64
      if (!cleanedBase64 || cleanedBase64.length === 0) {
        throw new Error("無效的 Base64 字串");
      }

      const buffer = Buffer.from(cleanedBase64, "base64");
      const aiImageBlob = new Blob([buffer], { type: "image/png" });

      aiSuggestionsUrl = await uploadImage(aiImageBlob);
      if (!aiSuggestionsUrl) {
        throw new Error("無法上傳 AI 回饋圖片。");
      }
    } else if (feedback.type === "text") {
      aiAnalysis = feedback.suggestions;
    }

    const recordData = {
      participantId: participantId,
      taskDescription: taskDescription,
      userSketchUrl: userSketchUrl,
      aiFeedbackSuggestionsUrl: aiSuggestionsUrl,
      aiFeedbackAnalysis: aiAnalysis,
      feedbackMode: feedbackMode,
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "feedbackRecords"), recordData);
    console.log("記錄已成功寫入 Firestore, ID:", docRef.id);

    return { recordData, userSketchUrl, docId: docRef.id };
  } catch (error) {
    console.error("上傳失敗：", error);
    throw new Error(`上傳失敗: ${error.message}`);
  }
}
