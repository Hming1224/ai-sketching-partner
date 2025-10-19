
import { db, storage } from "./firebase";
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// I will keep uploadImage since uploadSketchAndFeedback depends on it.
export async function uploadImage(blob, participantId, sketchIndex, sketchType, feedbackMode) {
  if (!participantId || !sketchIndex || !sketchType || !feedbackMode) {
    throw new Error("Participant ID, sketch index, sketch type, and feedback mode are required for upload.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = `participants/${participantId}/${feedbackMode}/${sketchIndex}_${sketchType}_${timestamp}.png`;
  const storageRef = ref(storage, filePath);

  try {
    const snapshot = await uploadBytes(storageRef, blob);
    const imageUrl = await getDownloadURL(snapshot.ref);
    console.log(`Image uploaded to: ${filePath}`);
    return imageUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
}


export async function uploadSketchAndFeedback(
  blob,
  participantId,
  sketchCount,
  prompt,
  feedback,
  selectedMode,
  targetUser,
  userNeed,
  drawingStartTime,
  toolChangesCount,
  feedbackResponseTime,
  feedbackDisplayDuration,
  drawingDuration
) {
  const userSketchUrl = await uploadImage(blob, participantId, sketchCount, 'user_sketch', selectedMode);

  let suggestions_url = feedback.suggestions;
  if (suggestions_url && suggestions_url.startsWith('data:image')) {
    const suggestionBlob = await (await fetch(suggestions_url)).blob();
    suggestions_url = await uploadImage(suggestionBlob, participantId, sketchCount, 'ai_suggestion', selectedMode);
  }

  const docId = `${participantId}_${selectedMode}_${sketchCount}`;
  const feedbackRef = doc(db, "feedback", docId);

  await setDoc(feedbackRef, {
    participantId,
    sketchCount,
    prompt,
    feedback: {
      ...feedback,
      suggestions: suggestions_url,
    },
    selectedMode,
    targetUser,
    userNeed,
    userSketchUrl,
    drawingStartTime,
    toolChangesCount,
    feedbackResponseTime,
    feedbackDisplayDuration,
    drawingDuration,
    createdAt: serverTimestamp(),
  });

  return { docId, userSketchUrl };
}

export async function createParticipantInfo(participantId, selectedMode) {
  if (!participantId || !selectedMode) {
    throw new Error("Participant ID and selected mode are required.");
  }
  const participantRef = doc(db, "participants", participantId);
  await setDoc(participantRef, {
    selectedMode: selectedMode,
    createdAt: serverTimestamp(),
  });
}

export async function getParticipantData(participantId) {
  if (!participantId) return null;

  const participantRef = doc(db, "participants", participantId);
  const participantSnap = await getDoc(participantRef);

  if (!participantSnap.exists()) {
    return null; // Participant not found
  }

  const participantData = participantSnap.data();

  const feedbackQuery = query(
    collection(db, "feedback"),
    where("participantId", "==", participantId),
    orderBy("sketchCount", "asc") // Get the oldest first
  );

  const feedbackSnap = await getDocs(feedbackQuery);
  const feedbackHistory = feedbackSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      participantId: data.participantId,
      sketchCount: data.sketchCount,
      prompt: data.prompt,
      feedback: data.feedback,
      selectedMode: data.selectedMode,
      targetUser: data.targetUser,
      userNeed: data.userNeed,
      userSketchUrl: data.userSketchUrl,
      drawingStartTime: data.drawingStartTime?.toDate(),
      toolChangesCount: data.toolChangesCount,
      feedbackResponseTime: data.feedbackResponseTime,
      feedbackDisplayDuration: data.feedbackDisplayDuration,
      drawingDuration: data.drawingDuration,
      timestamp: data.createdAt?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  });

  return {
    selectedMode: participantData.selectedMode,
    feedbackHistory: feedbackHistory,
  };
}
