// page.js
"use client";

import { useRef, useState, useEffect } from "react";
import CanvasArea from "@/components/CanvasArea";
import BrushSettingsPanel from "@/components/BrushSettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { uploadSketchAndFeedback, createParticipantInfo } from "@/lib/upload";
import AILoadingIndicator from "@/components/AILoadingIndicator";
import { X } from "lucide-react";

const DEFAULT_BRUSH_OPTIONS = {
  size: 8,
  thinning: 0.5,
  streamline: 0.5,
  smoothing: 0.5,
  color: "#000000",
};

const FEEDBACK_MODES = {
  "sketch-text": {
    title: "草圖文字分析",
    description: "AI 分析你的草圖並提供文字建議",
    borderClass: "border-blue-400",
    bgClass: "bg-blue-50",
    dotBorder: "border-blue-400",
    dotBg: "bg-blue-400",
    textColorClass: "text-blue-700",
  },
  "sketch-image": {
    title: "草圖圖像建議",
    description: "AI 分析草圖並生成改進版本圖像",
    borderClass: "border-purple-400",
    bgClass: "bg-purple-50",
    dotBorder: "border-purple-400",
    dotBg: "bg-purple-400",
    textColorClass: "text-purple-700",
  },
  "task-text": {
    title: "任務文字發想",
    description: "AI 基於任務描述提供創意文字建議",
    borderClass: "border-green-400",
    bgClass: "bg-green-50",
    dotBorder: "border-green-400",
    dotBg: "bg-green-400",
    textColorClass: "text-green-700",
  },
  "task-image": {
    title: "任務圖像發想",
    description: "AI 基於任務描述生成創意圖像參考",
    borderClass: "border-orange-400",
    bgClass: "bg-orange-50",
    dotBorder: "border-orange-400",
    dotBg: "bg-orange-400",
    textColorClass: "text-orange-700",
  },
};

export default function Home() {
  const [participantId, setParticipantId] = useState("");
  const [selectedMode, setSelectedMode] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [brushOptions, setBrushOptions] = useState(DEFAULT_BRUSH_OPTIONS);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [uploadedImageFile, setUploadedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const currentModeConfig = FEEDBACK_MODES[selectedMode];
  const canvasRef = useRef();
  const [prompt, setPrompt] = useState(
    "請您繪製一張能夠在長照中心使用的椅子，您可以從不同設計面向去思考這張椅子的功能、結構、材質等，任何發想形式或呈現手法不侷限，您可以嘗試想像在這樣環境中會有什麼樣使用者，他們會如何使用這樣椅子，請您盡可能繪製越多草圖越好。"
  );
  const [targetUser, setTargetUser] = useState("");
  const [userNeed, setUserNeed] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);
  const areInputsEmpty = !targetUser && !userNeed;

  useEffect(() => {
    const canvasInstance = canvasRef.current;
    if (canvasInstance) {
      const handleCanvasChange = () => {
        setIsCanvasEmpty(canvasInstance.isEmpty());
      };
      canvasInstance.addChangeListener(handleCanvasChange);
      return () => {
        canvasInstance.removeChangeListener(handleCanvasChange);
      };
    }
  }, []);

  const handleUserInputChange = (setter, value) => {
    setter(value);
    setIsEditing(true);
  };
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const handleClear = () => {
    const confirmed = confirm("確定要清除畫布嗎？此操作無法復原。");
    if (!confirmed) return;
    canvasRef.current?.clearCanvas();
    setIsCanvasEmpty(true);
  };
  const handleDownload = () => canvasRef.current?.downloadCanvas();
  const handleParticipantLogin = async () => {
    if (!participantId.trim()) {
      alert("請輸入受試者 ID");
      return;
    }
    if (!selectedMode) {
      alert("請選擇 AI 回饋模式");
      return;
    }
    try {
      await createParticipantInfo(participantId.trim(), selectedMode);
      setIsLoggedIn(true);
      setBrushOptions({ ...DEFAULT_BRUSH_OPTIONS });
      setFeedbackHistory([]);
      if (canvasRef.current?.clearCanvas) {
        canvasRef.current.clearCanvas();
      }
    } catch (error) {
      alert("系統設定失敗，請重試");
    }
  };
  const handleStartNewExperiment = () => {
    const confirmed = confirm("確定要開始新的實驗嗎？目前的進度將會清除。");
    if (!confirmed) return;
    setParticipantId("");
    setSelectedMode("");
    setIsLoggedIn(false);
    setFeedbackHistory([]);
    setBrushOptions({ ...DEFAULT_BRUSH_OPTIONS });
    handleClearUploadedImage();
    setIsSaved(false);
    setIsEditing(false);
    setTargetUser("");
    setUserNeed("");
    setIsCanvasEmpty(true);
  };
  const handleUploadButtonClick = () => fileInputRef.current?.click();
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      canvasRef.current?.clearCanvas();
      setIsCanvasEmpty(false);
    }
  };
  const handleClearUploadedImage = () => {
    setUploadedImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsCanvasEmpty(canvasRef.current?.isEmpty() ?? true);
  };
  const handleSaveInputs = () => {
    if (areInputsEmpty) {
      alert("請至少輸入一項內容後再儲存。");
      return;
    }
    setIsSaved(true);
    setIsEditing(false);
  };
  const handleEditInputs = () => {
    setIsEditing(true);
  };

  const handleSendToAI = async () => {
    if (!isLoggedIn) return;
    if (!isSaved) {
      alert("請先點擊「儲存」按鈕來鎖定您的設計對象與需求。");
      return;
    }
    const blob = await canvasRef.current?.getCanvasImageBlob();
    if (!blob) {
      alert("請先在畫布上繪圖。");
      return;
    }
    setIsLoadingAI(true);
    const formData = new FormData();
    formData.append("taskDescription", prompt);
    formData.append("image", blob, "sketch.png");
    formData.append("feedbackType", selectedMode);
    formData.append("targetUser", targetUser);
    formData.append("userNeed", userNeed);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      const feedback = data.feedback;
      const result = await uploadSketchAndFeedback(
        blob,
        participantId.trim(),
        prompt,
        feedback,
        selectedMode
      );
      const newFeedbackRecord = {
        id: result.docId,
        timestamp: new Date(),
        taskDescription: prompt,
        feedback: feedback,
        feedbackMode: selectedMode,
        imageUrl: result.userSketchUrl,
        docId: result.docId,
      };
      setFeedbackHistory((prev) => [newFeedbackRecord, ...prev]);
    } catch (error) {
      console.error("處理失敗：", error);
      alert("處理失敗，請重試");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleSendUploadedImageToAI = async () => {
    if (!isLoggedIn) return;
    if (!uploadedImageFile) {
      alert("沒有已上傳的圖片。");
      return;
    }
    if (!isSaved) {
      alert("請先點擊「儲存」按鈕來鎖定您的設計對象與需求。");
      return;
    }
    setIsLoadingAI(true);
    const formData = new FormData();
    formData.append("taskDescription", prompt);
    formData.append("image", uploadedImageFile, uploadedImageFile.name);
    formData.append("feedbackType", selectedMode);
    formData.append("targetUser", targetUser);
    formData.append("userNeed", userNeed);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      const feedback = data.feedback;
      const result = await uploadSketchAndFeedback(
        uploadedImageFile,
        participantId.trim(),
        prompt,
        feedback,
        selectedMode
      );
      const newFeedbackRecord = {
        id: result.docId,
        timestamp: new Date(),
        taskDescription: prompt,
        feedback: feedback,
        feedbackMode: selectedMode,
        imageUrl: result.userSketchUrl,
        docId: result.docId,
      };
      setFeedbackHistory((prev) => [newFeedbackRecord, ...prev]);
      handleClearUploadedImage();
    } catch (error) {
      console.error("處理失敗：", error);
      alert("處理失敗，請重試");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const isSendButtonDisabled =
    isLoadingAI || !isSaved || (!uploadedImageFile && isCanvasEmpty);

  const renderFeedbackDetails = (analysis, mode) => {
    if (!analysis || typeof analysis !== "object" || analysis.error) {
      return (
        <p className="text-sm text-gray-500">回饋內容載入中...或生成失敗</p>
      );
    }

    const isTaskMode = mode.includes("task");
    const isSketchMode = mode.includes("sketch");
    const hasUserNeed =
      analysis.target_user_chinese && analysis.key_user_need_chinese;
    const hasModifications =
      analysis.modification_function_chinese ||
      analysis.modification_structure_chinese ||
      analysis.modification_material_chinese;

    // Only render for text-based modes
    if (mode === "sketch-text" || mode === "task-text") {
      return (
        <div className="space-y-4">
          {isTaskMode && hasUserNeed && (
            <div className="bg-gray-100 p-3 rounded-md">
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-semibold">設計對象：</span>
                  {analysis.target_user_chinese}
                </p>
                <p>
                  <span className="font-semibold">用戶需求：</span>
                  {analysis.key_user_need_chinese}
                </p>
              </div>
            </div>
          )}

          {isSketchMode && analysis.sketch_style_analysis_chinese && (
            <div className="bg-gray-100 p-3 rounded-md">
              <strong className="block mb-1">草圖分析</strong>
              <div className="text-sm">
                {analysis.sketch_style_analysis_chinese}
              </div>
            </div>
          )}

          {hasModifications && (
            <div className="bg-gray-100 p-3 rounded-md">
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-semibold">功能：</span>
                  {analysis.modification_function_chinese}
                </p>
                <p>
                  <span className="font-semibold">結構：</span>
                  {analysis.modification_structure_chinese}
                </p>
                <p>
                  <span className="font-semibold">材質：</span>
                  {analysis.modification_material_chinese}
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // For sketch-image and task-image, return null to render nothing
    return null;
  };

  return (
    <div className="relative">
      {!isLoggedIn ? (
        <div className="fixed inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full mx-4 h-fill">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-800">
              歡迎參與草圖設計實驗
            </h2>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                受試者 ID
              </label>
              <Input
                type="text"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                placeholder="例如：P01、P02..."
                className="w-full py-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                選擇 AI 回饋模式
              </label>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(FEEDBACK_MODES).map(([mode, config]) => (
                  <label
                    key={mode}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      selectedMode === mode
                        ? `${config.borderClass} ${config.bgClass}`
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="feedbackMode"
                      value={mode}
                      checked={selectedMode === mode}
                      onChange={(e) => setSelectedMode(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 mt-0.5 ${
                          selectedMode === mode
                            ? config.dotBorder
                            : "border-gray-300"
                        }`}
                      >
                        {selectedMode === mode && (
                          <div
                            className={`w-full h-full rounded-full ${config.dotBg} scale-50`}
                          />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800">
                          {config.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {config.description}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <Button
              onClick={handleParticipantLogin}
              disabled={!participantId.trim() || !selectedMode}
              className="w-full text-lg bg-black text-white py-6 rounded-md font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              開始實驗
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 p-6">
        <div className="space-y-4">
          <div
            className={`p-3 ${currentModeConfig?.bgClass} rounded flex justify-between items-center`}
          >
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">受試者：</span>
              <span
                className={`font-semibold ${currentModeConfig?.textColorClass}`}
              >
                {participantId}
              </span>
            </div>
            <button
              onClick={handleStartNewExperiment}
              className="text-xs bg-white hover:bg-gray-50 text-gray-600 px-3 py-1 rounded border transition-colors"
            >
              新受試者
            </button>
          </div>
          <div className="border p-4 rounded bg-gray-100">
            <h2 className="text-lg font-bold mb-2">📜 設計任務</h2>
            <p className="text-sm">{prompt}</p>
          </div>

          <div className="space-y-4 p-4 rounded bg-gray-100 border">
            <h3 className="text-lg font-bold">🎯 定義設計情境</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                我的設計對象是：
              </label>
              <Input
                type="text"
                value={targetUser}
                onChange={(e) =>
                  handleUserInputChange(setTargetUser, e.target.value)
                }
                placeholder="例如：久坐的老年人"
                disabled={isSaved && !isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                我認為他們有什麼樣需求：
              </label>
              <Input
                type="text"
                value={userNeed}
                onChange={(e) =>
                  handleUserInputChange(setUserNeed, e.target.value)
                }
                placeholder="例如：需要舒適且透氣的椅面"
                disabled={isSaved && !isEditing}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleSaveInputs}
                disabled={!isEditing || areInputsEmpty}
                className="bg-gray-800 text-white hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                儲存
              </Button>
              <Button
                onClick={handleEditInputs}
                disabled={!isSaved || isEditing}
                className="bg-gray-500 text-white hover:bg-gray-400 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                修改
              </Button>
              {isSaved ? (
                <span className="text-green-600 text-sm font-medium">
                  已儲存，可以開始繪圖。
                </span>
              ) : (
                <span className="text-gray-500 text-sm">
                  輸入後請儲存，否則無法獲得回饋。
                </span>
              )}
            </div>
          </div>

          <BrushSettingsPanel
            options={brushOptions}
            onChange={(key, value) =>
              setBrushOptions((prev) => ({ ...prev, [key]: value }))
            }
          />

          <div className="relative">
            <CanvasArea
              ref={canvasRef}
              brushOptions={brushOptions}
              onChange={() =>
                setIsCanvasEmpty(canvasRef.current?.isEmpty() ?? true)
              }
            />
            {imagePreviewUrl && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-400 rounded-lg">
                <Image
                  src={imagePreviewUrl}
                  alt="圖片預覽"
                  width={400}
                  height={400}
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={handleClearUploadedImage}
                  className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-red-100 transition-colors"
                  title="清除上傳的圖片"
                >
                  <X className="w-5 h-5 text-red-500" />
                </button>
                <p className="mt-2 text-sm text-gray-600">
                  已上傳圖片，將以此圖獲得 AI 回饋。
                </p>
              </div>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/jpg"
          />

          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleUndo}>返回</Button>
              <Button onClick={handleRedo}>重做</Button>
              <Button onClick={handleClear}>清除畫布</Button>
              <Button onClick={handleDownload}>下載繪圖</Button>
              <Button onClick={handleUploadButtonClick} variant="outline">
                上傳圖片 (臨時)
              </Button>
              <Button
                onClick={
                  uploadedImageFile
                    ? handleSendUploadedImageToAI
                    : handleSendToAI
                }
                disabled={isSendButtonDisabled}
                className={`p-3 rounded-md font-medium border transition-colors ${
                  isSendButtonDisabled
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : currentModeConfig
                    ? `${currentModeConfig.bgClass} ${
                        currentModeConfig.borderClass
                      } ${
                        currentModeConfig.textColorClass
                      } hover:bg-${currentModeConfig.bgClass.replace(
                        "-50",
                        "-100"
                      )}`
                    : "bg-gray-50 text-gray-700"
                }`}
              >
                {isLoadingAI ? "AI 分析中..." : "獲取 AI 回饋"}
              </Button>
            </div>
          </div>
        </div>

        <div className="border p-4 rounded bg-gray-100 h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">🐻‍❄️ AI 草圖協作夥伴</h2>
            {feedbackHistory.length > 0 && (
              <span className="text-xs text-gray-500">
                回應次數：{feedbackHistory.length}
              </span>
            )}
          </div>
          <div className="overflow-y-auto space-y-4 h-screen pb-20">
            {isLoadingAI && <AILoadingIndicator config={currentModeConfig} />}
            {feedbackHistory.length > 0 ? (
              feedbackHistory.map((record, recordIdx) => {
                const feedbackConfig = FEEDBACK_MODES[record.feedbackMode];
                return (
                  <div
                    key={record.docId}
                    className={`p-4 bg-white rounded-md shadow-sm border-l-4 ${feedbackConfig?.borderClass}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3
                        className={`text-sm font-medium ${feedbackConfig?.textColorClass}`}
                      >
                        回饋 {feedbackHistory.length - recordIdx}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {record.timestamp.toLocaleTimeString("zh-TW", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                     {/* ✨ 添加條件判斷 */}
                     {(record.feedbackMode === 'sketch-text' || record.feedbackMode === 'sketch-image') && record.imageUrl && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">你當前的設計：</h4>
                        <Image src={record.imageUrl} alt="受試者草圖" width={200} height={200} className="w-full max-w-48 max-h-48 object-contain border rounded cursor-pointer hover:opacity-80 transition-opacity mx-auto block" onClick={() => window.open(record.imageUrl, "_blank")} title="點擊查看大圖" />
                      </div>
                    )}
                    <div className="mb-3">
                      <h5 className="text-sm font-medium mb-2 text-gray-700">
                        設計建議：
                      </h5>
                      {/* 如果有圖片則顯示圖片 */}
                      {record.feedback.type === "image" &&
                        record.feedback.suggestions && (
                          <div className="mt-2 mb-4">
                            <Image
                              src={record.feedback.suggestions}
                              alt="AI 回饋圖像"
                              width={512}
                              height={512}
                              className="rounded-lg shadow-md w-full h-auto cursor-pointer"
                              onClick={() =>
                                window.open(
                                  record.feedback.suggestions,
                                  "_blank"
                                )
                              }
                              title="點擊查看大圖"
                            />
                          </div>
                        )}
                      {/* 如果是 sketch-text 或 task-text 模式，才顯示文字回饋框 */}
                      {(record.feedbackMode === "sketch-text" ||
                        record.feedbackMode === "task-text") &&
                        record.feedback.analysis &&
                        renderFeedbackDetails(
                          record.feedback.analysis,
                          record.feedbackMode
                        )}
                    </div>
                  </div>
                );
              })
            ) : !isLoadingAI ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-2">尚未取得回饋</p>
                <p className="text-xs text-gray-400">
                  完成草圖或上傳圖片後點擊「獲取 AI 回饋」開始
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
