"use client";

import { useRef, useState } from "react";
import CanvasArea from "@/components/CanvasArea";
import BrushSettingsPanel from "@/components/BrushSettingsPanel";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { uploadSketchAndFeedback, createParticipantInfo } from "@/lib/upload";
import AILoadingIndicator from "@/components/AILoadingIndicator";

// 配合你的 BrushSettingsPanel 的預設值
const DEFAULT_BRUSH_OPTIONS = {
  size: 8,
  thinning: 0.5,
  streamline: 0.5,
  smoothing: 0.5,
  color: "#000000",
};

// 模式配置
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
  // 簡化的 state（移除複雜的使用者管理）
  const [participantId, setParticipantId] = useState("");
  const [selectedMode, setSelectedMode] = useState(""); //選擇哪個AI回饋模式
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [brushOptions, setBrushOptions] = useState(DEFAULT_BRUSH_OPTIONS);
  const [isLoadingAI, setIsLoadingAI] = useState(false); // AI載入回饋狀態

  const currentModeConfig = FEEDBACK_MODES[selectedMode];

  const canvasRef = useRef();
  const [prompt, setPrompt] = useState(
    "請您繪製一張能夠在長照中心使用的椅子，您可以從不同設計面向去思考這張椅子的功能、結構、材質等，任何發想形式或呈現手法不侷限，您可以嘗試想像在這樣環境中會有什麼樣使用者，他們會如何使用這樣椅子，請您盡可能繪製越多草圖越好。"
  );

  const handleUndo = () => {
    canvasRef.current?.undo();
  };

  const handleRedo = () => {
    canvasRef.current?.redo();
  };

  const handleClear = () => {
    const confirmed = confirm("確定要清除畫布嗎？此操作無法復原。");
    if (!confirmed) return;

    canvasRef.current?.clearCanvas();
  };

  const handleDownload = () => {
    canvasRef.current?.downloadCanvas();
  };

  // 受試者登入函數
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
      console.log("受試者登入:", participantId.trim(), "模式:", selectedMode);

      // 建立參與者資訊（包含模式）
      await createParticipantInfo(participantId.trim(), selectedMode);

      setIsLoggedIn(true);
      setBrushOptions({ ...DEFAULT_BRUSH_OPTIONS });
      setFeedbackHistory([]);

      if (canvasRef.current?.clearCanvas) {
        canvasRef.current.clearCanvas();
      }

      console.log("實驗環境已準備完成");
    } catch (error) {
      console.error("登入設定失敗:", error);
      alert("系統設定失敗，請重試");
    }
  };

  // 重新開始實驗（新受試者）
  const handleStartNewExperiment = () => {
    const confirmed = confirm("確定要開始新的實驗嗎？目前的進度將會清除。");
    if (!confirmed) return;

    setParticipantId("");
    setSelectedMode(""); // 重置模式選擇
    setIsLoggedIn(false);
    setFeedbackHistory([]);
    setBrushOptions({ ...DEFAULT_BRUSH_OPTIONS });

    if (canvasRef.current?.clearCanvas) {
      canvasRef.current.clearCanvas();
    }

    console.log("已重置為新實驗");
  };

  // 統一的 AI 回饋函數、處理 JSON 結構回應
  const handleSendToAI = async () => {
    if (!isLoggedIn) {
      console.error("受試者未登入");
      return;
    }

    console.log(`handleSendToAI 開始執行，模式: ${selectedMode}`);

    const blob = await canvasRef.current?.getCanvasImageBlob();
    if (!blob) {
      console.error("無法取得畫布影像");
      return;
    }

    setIsLoadingAI(true);

    const formData = new FormData();
    formData.append("taskDescription", prompt);
    formData.append("image", blob, "sketch.png");
    formData.append("feedbackType", selectedMode); // 傳入選擇的模式

    try {
      console.log("發送 AI API 請求...");
      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("AI 回饋 API 錯誤：", data?.error);
        setIsLoadingAI(false);
        alert("AI 回饋失敗，請重試");
        return;
      }

      const feedback = data.feedback;
      console.log("收到 AI 回饋:", feedback);

      // 使用 upload service（傳入模式）
      const result = await uploadSketchAndFeedback(
        blob,
        participantId.trim(),
        prompt,
        feedback,
        selectedMode
      );

      // 加到前端歷史記錄
      const newFeedbackRecord = {
        id: result.recordData.timestamp,
        timestamp: new Date(),
        taskDescription: prompt,
        feedback: feedback,
        feedbackMode: selectedMode,
        imageUrl: result.imageUrl,
        docId: result.docId,
      };

      setFeedbackHistory((prev) => [newFeedbackRecord, ...prev]);
      console.log("完整流程完成");
    } catch (error) {
      console.error("處理失敗：", error);
      alert("處理失敗，請重試");
    } finally {
      setIsLoadingAI(false);
    }
  };

  return (
    <div className="relative">
      {!isLoggedIn ? (
        <div className="fixed inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full mx-4 h-fill">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-800">
              歡迎參與草圖設計實驗
            </h2>

            {/* 受試者 ID 輸入 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                受試者 ID
              </label>
              <input
                type="text"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                placeholder="例如：P01、P02..."
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* AI 回饋模式選擇 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                選擇 AI 回饋模式
              </label>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(FEEDBACK_MODES).map(([mode, config]) => (
                  <label
                    key={mode}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all 
                               ${
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
              className="w-full text-lg bg-blue-500 text-white py-6 rounded-md font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              開始實驗
            </Button>
          </div>
        </div>
      ) : null}

      {/* 主要內容區域 */}
      <div className="grid grid-cols-2 gap-4 p-6">
        {/* 左側：任務區、筆刷設定、畫布、控制按鈕 */}
        <div className="space-y-4">
          {/* 受試者資訊顯示 */}
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

          {/* 任務說明 */}
          <div className="border p-4 rounded bg-gray-50">
            <h2 className="text-lg font-bold mb-2">📜 設計任務</h2>
            <p className="text-sm">{prompt}</p>
          </div>

          {/* 筆刷設定區 */}
          <BrushSettingsPanel
            options={brushOptions}
            onChange={(key, value) =>
              setBrushOptions((prev) => ({ ...prev, [key]: value }))
            }
          />

          {/* 畫布 */}
          <CanvasArea ref={canvasRef} brushOptions={brushOptions} />

          {/* 控制按鈕 */}
          <div className="space-y-4">
            {/* 畫布控制按鈕 */}
            <div className="flex gap-2">
              <Button onClick={handleUndo}>返回</Button>
              <Button onClick={handleRedo}>重做</Button>
              <Button onClick={handleClear}>清除畫布</Button>
              <Button onClick={handleDownload}>下載繪圖</Button>
              {/* AI 回饋按鈕（根據選擇的模式顯示對應按鈕） */}
              <Button
                onClick={handleSendToAI}
                disabled={isLoadingAI}
                className={` p-3 rounded-md font-medium border transition-colors ${
                  isLoadingAI
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : currentModeConfig
                    ? `${currentModeConfig.bgClass} ${
                        currentModeConfig.borderClass
                      } ${
                        currentModeConfig.textColorClass
                      } hover:bg-${currentModeConfig.bgClass
                        .replace("bg-", "")
                        .replace("-50", "-100")}`
                    : "bg-gray-50 text-gray-700"
                }`}
              >
                {isLoadingAI ? "AI 分析中..." : "獲取 AI 回饋"}
              </Button>
            </div>
          </div>
        </div>

        {/* 右側：AI 回饋區塊 */}
        <div className="border p-4 rounded bg-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">🐻‍❄️ AI 草圖協作夥伴</h2>

            {feedbackHistory.length > 0 && (
              <span className="text-xs text-gray-500">
                回應次數：{feedbackHistory.length}
              </span>
            )}
          </div>

          <div className="overflow-y-auto space-y-4 h-screen">
            {isLoadingAI && <AILoadingIndicator config={currentModeConfig} />}
            {feedbackHistory.length > 0 ? (
              feedbackHistory.map((record, recordIdx) => {
                const feedbackConfig = FEEDBACK_MODES[record.feedbackMode];
                return (
                  <div
                    key={record.id}
                    className={`p-4 bg-white rounded-md shadow-sm border-l-4 ${feedbackConfig?.borderClass}`}
                  >
                    {/* 回饋標題和時間 */}
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

                    {/* 草圖展示 */}
                    {record.imageUrl && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          你畫的草圖：
                        </h4>
                        <Image
                          src={record.imageUrl}
                          alt="受試者草圖"
                          width={200}
                          height={200}
                          className="w-full max-w-48 max-h-48 object-contain border rounded cursor-pointer hover:opacity-80 transition-opacity mx-auto block"
                          onClick={() => window.open(record.imageUrl, "_blank")}
                          title="點擊查看大圖"
                        />
                      </div>
                    )}

                    {/* AI 回饋內容 */}
                    <div className="mb-3">
                      <h5 className="text-sm font-semibold mb-2 text-gray-800">
                        設計建議
                      </h5>
                      {/* 根據回饋的類型來渲染 */}
                      {record.feedback.type === "text" ? (
                        <div className="space-y-3">
                          {typeof record.feedback.suggestions === "string" ? (
                            <p
                              className={`text-sm leading-relaxed text-gray-800 pl-3 border-l-2 ${feedbackConfig?.borderClass} ${feedbackConfig?.bgClass} p-2 rounded whitespace-pre-wrap`}
                            >
                              {record.feedback.suggestions}
                            </p>
                          ) : (
                            <div
                              className={`text-sm leading-relaxed text-gray-800 pl-3 border-l-2 ${feedbackConfig?.borderClass} ${feedbackConfig?.bgClass} p-2 rounded whitespace-pre-wrap space-y-2`}
                            >
                              {Object.entries(record.feedback.suggestions).map(
                                ([key, value]) => (
                                  <div key={key}>
                                    <span className="font-semibold">
                                      {key}:
                                    </span>{" "}
                                    {value}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      ) : record.feedback.type === "image" ? (
                        <div>
                          {record.feedback.suggestions && (
                            <div className="mt-4">
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
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          回饋內容載入中...
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : !isLoadingAI ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-2">尚未取得回饋</p>
                <p className="text-xs text-gray-400">
                  完成草圖後點擊「送出給 AI 回饋」開始
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
