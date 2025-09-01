// src/lib/upload.js
import { storage, db } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";

/**
 * 上傳草圖圖片到 Firebase Storage 並儲存記錄到 Firestore
 * @param {Blob} imageBlob - 圖片 blob 資料
 * @param {string} participantId - 受試者 ID
 * @param {string} taskDescription - 任務描述
 * @param {string} aiFeedback - AI 回饋內容
 * @returns {Promise<{imageUrl: string, docId: string}>}
 */
export const uploadSketchAndFeedback = async (
  imageBlob,
  participantId,
  taskDescription,
  aiFeedback
) => {
  try {
    const timestamp = Date.now();

    // 上傳圖片到 Storage
    // 路徑格式：sketches/[participantId]/[timestamp].png
    const imageRef = ref(storage, `sketches/${participantId}/${timestamp}.png`);

    console.log("上傳圖片到 Storage...");
    await uploadBytes(imageRef, imageBlob);
    const imageUrl = await getDownloadURL(imageRef);
    console.log("圖片上傳成功");

    // 儲存記錄到 Firestore（使用 subcollection 結構）
    console.log("存儲記錄到 Firestore...");

    // 路徑：participants/[participantId]/sketches/[docId]
    const participantDocRef = doc(db, "participants", participantId);
    const sketchesCollectionRef = collection(participantDocRef, "sketches");

    const recordData = {
      taskDescription: taskDescription,
      aiFeedback: aiFeedback,
      imageUrl: imageUrl,
      createdAt: serverTimestamp(),
      timestamp: timestamp,
    };

    const docRef = await addDoc(sketchesCollectionRef, recordData);
    console.log("Firestore 記錄成功，文件 ID:", docRef.id);

    return {
      imageUrl: imageUrl,
      docId: docRef.id,
      recordData: recordData,
    };
  } catch (error) {
    console.error("上傳失敗：", error);
    throw error;
  }
};
export const createParticipantInfo = async (participantId, feedbackMode) => {
  try {
    // 路徑：experiments/[feedbackMode]/participants/[participantId]
    const participantRef = doc(
      db,
      "experiments",
      feedbackMode,
      "participants",
      participantId
    );

    await setDoc(
      participantRef,
      {
        participantId: participantId,
        feedbackMode: feedbackMode,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        totalResponses: 0,
      },
      { merge: true }
    );

    console.log(
      `參與者資訊已建立: experiments/${feedbackMode}/participants/${participantId}`
    );
  } catch (error) {
    console.error("建立參與者資訊失敗:", error);
  }
};
