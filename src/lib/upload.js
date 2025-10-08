
import { db, storage } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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
  userNeed
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
