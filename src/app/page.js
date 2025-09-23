"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import CanvasArea from "@/components/CanvasArea";
import BrushSettingsPanel from "@/components/BrushSettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { uploadSketchAndFeedback, createParticipantInfo } from "@/lib/upload";
import AILoadingIndicator from "@/components/AILoadingIndicator";
import ClientOnly from "@/components/ClientOnly";
import { X } from "lucide-react";
import HistoryModal from "@/components/HistoryModal"; // 匯入新的 Modal 元件
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const DEFAULT_BRUSH_OPTIONS = {
  size: 8,
  thinning: 0.5,
  streamline: 0.8,
  smoothing: 0.6,
  color: "#000000",
  isEraser: false,
};

const FEEDBACK_MODES = {
  "sketch-text": {
    title: "草圖文字建議",
    description: "AI 分析你的草圖並提供文字建議",
    borderClass: "border-blue-400",
    bgClass: "bg-blue-50",
    dotBorder: "border-blue-400",
    dotBg: "bg-blue-400",
    textColorClass: "text-blue-700",
    welcomeMessage:
      " 嗨！我是您的草圖協作夥伴，以下是一張設計範例圖片，圖片僅供參考，希望能給您些想法，您不必照這張圖片繪製。重要的是，能夠幫助您想出更多的創意。完成之後記得點擊「獲取回饋」按鈕，我就會分析您的草圖並提供文字建議，您可以將這些想法作為靈感來繪製草圖。",
    warningMessage:
      "以上建議僅供參考，請照自己的意思創作，在右邊畫下一張草圖。",
  },
  "sketch-image": {
    title: "草圖圖像建議",
    description: "AI 分析你的草圖並生成參考圖像",
    borderClass: "border-purple-400",
    bgClass: "bg-purple-50",
    dotBorder: "border-purple-400",
    dotBg: "bg-purple-400",
    textColorClass: "text-purple-700",
    welcomeMessage:
      "嗨！我是您的草圖協作夥伴，以下是一張設計範例圖片，圖片僅供參考，希望能給您些想法，您不必照這張圖片繪製。重要的是，能夠幫助您想出更多的創意。完成之後記得點擊「獲取回饋」按鈕，我就會分析您的設計並生成一張新的參考圖像，您可以將這些想法作為靈感來繪製草圖。",
    warningMessage:
      "以上建議僅供參考，請照自己的意思創作，在右邊畫下一張草圖。",
  },
  "task-text": {
    title: "任務文字發想",
    description: "AI 基於任務描述提供創意文字建議",
    borderClass: "border-[#00C59F]",
    bgClass: "bg-[#E7F6F3]",
    dotBorder: "border-[#00C59F]",
    dotBg: "bg-[#00C59F]",
    textColorClass: "text-[#005D4B]",
    welcomeMessage:
      "嗨！我是您的草圖協作夥伴，以下是一張設計範例圖片，圖片僅供參考，希望能給您些想法，您不必照這張圖片繪製。重要的是，能夠幫助您想出更多的創意。完成之後記得點擊「獲取回饋」按鈕，我就會根據設計任務提供文字想法給你參考，您可以將這些想法作為靈感來繪製草圖。",
    warningMessage:
      "以上建議僅供參考，請照自己的意思創作，在右邊畫下一張草圖。",
  },
  "task-image": {
    title: "任務圖像發想",
    description: "AI 基於任務描述生成創意圖像參考",
    borderClass: "border-orange-400",
    bgClass: "bg-orange-50",
    dotBorder: "border-orange-400",
    dotBg: "bg-orange-400",
    textColorClass: "text-orange-700",
    welcomeMessage:
      "嗨！我是您的草圖協作夥伴，以下是一張設計範例圖片，圖片僅供參考，希望能給您些想法，您不必照這張圖片繪製。重要的是，能夠幫助您想出更多的創意。完成之後記得點擊「獲取回饋」按鈕，我就會根據設計任務生成一張參考圖像，您可以將這些想法作為靈感來繪製草圖。",
    warningMessage:
      "以上建議僅供參考，請照自己的意思創作，在右邊畫下一張草圖。",
  },
};

export default function Home() {
  const [participantId, setParticipantId] = useState("");
  const [selectedMode, setSelectedMode] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [brushOptions, setBrushOptions] = useState(DEFAULT_BRUSH_OPTIONS);
  const [sketchCount, setSketchCount] = useState(1);

  // [修改一] 使用 useRef 來記住不同工具的設定
  const savedBrushOptionsRef = useRef(DEFAULT_BRUSH_OPTIONS);
  const savedEraserSizeRef = useRef(60); // 橡皮擦預設尺寸為 60
  const inputFocusStyle = "focus-visible:ring-2 focus-visible:ring-ring";
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [uploadedImageFile, setUploadedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const currentModeConfig = FEEDBACK_MODES[selectedMode];
  const canvasRef = useRef();
  const [prompt, setPrompt] = useState(
    "請您繪製一張能夠在長照中心使用的椅子。您可以從不同設計面向去思考這張椅子的功能、結構、形狀、材質等等，呈現方式沒有局限。請您先試著去想像使用椅子的人和使用椅子的環境，他們會如何使用這張椅子，並在下方輸入您定義好的目標受眾和用戶需求。接下來，AI助手在下方會提供一些建議來協助您發想。您的目標是在20分鐘內透過與AI的協作，盡可能地創作最多的草圖。"
  );
  const [targetUser, setTargetUser] = useState("");
  const [userNeed, setUserNeed] = useState("");
  const [openAccordionItems, setOpenAccordionItems] = useState([
    "task",
    "context",
  ]);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);
  const [initialFeedbackState, setInitialFeedbackState] = useState("hidden"); // "hidden", "loading", "visible"
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyPageIndex, setHistoryPageIndex] = useState(0);
  const isSaveButtonDisabled = !targetUser.trim() || !userNeed.trim();

  const handleOpenHistoryModal = () => {
    if (feedbackHistory.length > 0) {
      setHistoryPageIndex(0);
      setIsHistoryModalOpen(true);
    }
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
  };

  const handleHistoryNext = () => {
    setHistoryPageIndex((prev) => Math.min(prev + 1, feedbackHistory.length - 1));
  };

  const handleHistoryPrev = () => {
    setHistoryPageIndex((prev) => Math.max(prev - 1, 0));
  };

  const updateCanvasEmptyStatus = useCallback(() => {
    setIsCanvasEmpty(canvasRef.current?.isEmpty() ?? true);
  }, []);
  useEffect(() => {
    if (isLoggedIn) {
      // 如果使用者已登入，為 body 加上 .disable-selection class
      document.body.classList.add("disable-selection");
    } else {
      // 如果使用者未登入（或已登出），則移除該 class
      document.body.classList.remove("disable-selection");
    }

    // 這是一個 cleanup 函式，確保在元件卸載時也會移除 class
    return () => {
      document.body.classList.remove("disable-selection");
    };
  }, [isLoggedIn]); // 這個 effect 的依賴項是 isLoggedIn
  useEffect(() => {
    const canvasInstance = canvasRef.current;
    if (canvasInstance) {
      canvasInstance.addChangeListener(updateCanvasEmptyStatus);
      return () => {
        canvasInstance.removeChangeListener(updateCanvasEmptyStatus);
      };
    }
  }, [updateCanvasEmptyStatus]);

  const handleUserInputChange = (setter, value) => {
    setter(value);
    setIsEditing(true);
  };
  const handleUndo = () => {
    if (isLoadingAI) return;
    canvasRef.current?.undo();
  };
  const handleRedo = () => {
    if (isLoadingAI) return;
    canvasRef.current?.redo();
  };

  // [修改二] 更新 handleEraserMode 函式，加入儲存與恢復邏輯
  const handleEraserMode = () => {
    setBrushOptions((prevOptions) => {
      if (prevOptions.isEraser) {
        // 從【橡皮擦】切換回【畫筆】
        savedEraserSizeRef.current = prevOptions.size;
        return { ...savedBrushOptionsRef.current, isEraser: false };
      } else {
        // 從【畫筆】切換到【橡皮擦】
        savedBrushOptionsRef.current = prevOptions;
        return {
          ...prevOptions,
          isEraser: true,
          size: savedEraserSizeRef.current,
        };
      }
    });
  };

  const handleClear = () => {
    if (isLoadingAI) return;
    const confirmed = confirm("確定要清除畫布嗎？此操作無法復原。");
    if (!confirmed) return;
    canvasRef.current?.clearCanvas();
    setIsCanvasEmpty(true);
  };
  const handleDownload = () => {
    if (isLoadingAI) return;
    canvasRef.current?.downloadCanvas();
  };
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
      setSketchCount(1);
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
    canvasRef.current?.clearCanvas();
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
    setSketchCount(1);
    setInitialFeedbackState("hidden");
    setOpenAccordionItems(["task", "context"]);
  };
  const handleUploadButtonClick = () => {
    if (isLoadingAI) return;
    fileInputRef.current?.click();
  };
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
    if (isLoadingAI) return;
    setUploadedImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsCanvasEmpty(canvasRef.current?.isEmpty() ?? true);
  };
  const handleSaveInputs = () => {
    // 這裡的檢查雖然在 UI 上已經擋掉，但作為最後防線是好的實踐
    if (!targetUser.trim() || !userNeed.trim()) {
      alert("請確保「目標受眾」與「用戶需求」都已填寫。");
      return;
    }
    const confirmed = window.confirm("一旦儲存就無法修改，請確認輸入內容無誤");
    if (confirmed) {
      setIsSaved(true);
      setIsEditing(false);
      setOpenAccordionItems((prev) => prev.filter((item) => item !== "task"));
      setInitialFeedbackState("loading");
      setTimeout(() => {
        setInitialFeedbackState("visible");
      }, 2000);
    }
  };

  const handleSendToAI = async () => {
    if (!isLoggedIn) return;
    if (!isSaved) {
      alert("請先點擊「儲存」按鈕來鎖定您的目標受眾與需求。");
      return;
    }
    if (canvasRef.current?.isDrawing()) {
      alert("請先完成繪圖再送出。");
      return;
    }

    const drawingData = canvasRef.current?.getDrawingData();
    if (
      !drawingData ||
      !drawingData.history ||
      drawingData.history.length === 0
    ) {
      alert("請先在畫布上繪圖。");
      return;
    }

    setIsLoadingAI(true);

    try {
      const blob = await new Promise((resolve) => {
        const { history, canvas } = drawingData;

        if (!canvas) {
          resolve(null);
          return;
        }

        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        history.forEach((stroke) => {
          stroke.points.forEach((point) => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
          });
        });

        if (minX === Infinity) {
          // No points drawn, get full canvas
          canvas.toBlob(resolve, "image/png");
          return;
        }

        const padding = 40;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropWidth = Math.min(canvas.width, maxX + padding) - cropX;
        const cropHeight = Math.min(canvas.height, maxY + padding) - cropY;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        const tempCtx = tempCanvas.getContext("2d");

        // Fill background with white
        tempCtx.fillStyle = "white";
        tempCtx.fillRect(0, 0, cropWidth, cropHeight);

        tempCtx.drawImage(
          canvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );

        tempCanvas.toBlob(resolve, "image/png");
      });

      if (!blob) {
        alert("無法擷取畫布，請重試。");
        throw new Error("Failed to get canvas blob.");
      }

      const formData = new FormData();
      formData.append("taskDescription", prompt);
      formData.append("image", blob, "sketch.png");
      formData.append("feedbackType", selectedMode);
      formData.append("targetUser", targetUser);
      formData.append("userNeed", userNeed);

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
        sketchCount,
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
      setSketchCount((prev) => prev + 1);
      canvasRef.current?.clearCanvas();
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
      alert("請先點擊「儲存」按鈕來鎖定您的目標受眾與需求。");
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
        sketchCount,
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
      setSketchCount((prev) => prev + 1);
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

    // [核心修改] 簡化渲染邏輯
    if (mode === "sketch-text" || mode === "task-text") {
      // For both modes, prioritize the single narrative feedback.
      if (analysis.narrative_feedback_chinese) {
        return (
          <div className="bg-gray-100 p-3 rounded-md">
            <p className="text-sm leading-relaxed">
              {analysis.narrative_feedback_chinese}
            </p>
          </div>
        );
      }

      // Fallback to a structured list if narrative generation fails.
      if (mode === "task-text") {
        const hasTaskTextFeedback =
          analysis.defined_target_user_chinese ||
          analysis.defined_user_need_chinese ||
          analysis.concept_structure_chinese;
        if (hasTaskTextFeedback) {
          return (
            <div className="bg-gray-100 p-3 rounded-md">
              <div className="text-sm space-y-2">
                {analysis.defined_target_user_chinese && (
                  <p>
                    <span className="font-semibold">目標用戶：</span>
                    {analysis.defined_target_user_chinese}
                  </p>
                )}
                {analysis.defined_user_need_chinese && (
                  <p>
                    <span className="font-semibold">用戶需求：</span>
                    {analysis.defined_user_need_chinese}
                  </p>
                )}
                {analysis.concept_structure_chinese && (
                  <p className="pt-2 border-t border-gray-200 mt-2">
                    <span className="font-semibold">結構概念：</span>
                    {analysis.concept_structure_chinese}
                  </p>
                )}
                {analysis.concept_form_chinese && (
                  <p>
                    <span className="font-semibold">形式概念：</span>
                    {analysis.concept_form_chinese}
                  </p>
                )}
                {analysis.concept_materiality_chinese && (
                  <p>
                    <span className="font-semibold">材質概念：</span>
                    {analysis.concept_materiality_chinese}
                  </p>
                )}
              </div>
            </div>
          );
        }
      } else {
        // Fallback for sketch-text
        const hasConcepts =
          analysis.concept_structure_chinese ||
          analysis.concept_form_chinese ||
          analysis.concept_materiality_chinese;
        if (hasConcepts) {
          return (
            <div className="bg-gray-100 p-3 rounded-md">
              <div className="text-sm space-y-1">
                {analysis.concept_structure_chinese && (
                  <p>
                    <span className="font-semibold">結構概念：</span>
                    {analysis.concept_structure_chinese}
                  </p>
                )}
                {analysis.concept_form_chinese && (
                  <p>
                    <span className="font-semibold">形式概念：</span>
                    {analysis.concept_form_chinese}
                  </p>
                )}
                {analysis.concept_materiality_chinese && (
                  <p>
                    <span className="font-semibold">材質概念：</span>
                    {analysis.concept_materiality_chinese}
                  </p>
                )}
              </div>
            </div>
          );
        }
      }
    }

    // For sketch-image and task-image, return null to render nothing
    return null;
  };

  return (
    <div className="relative flex flex-col h-screen p-6 gap-6">
      {!isLoggedIn ? (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-50 flex items-center justify-center z-50">
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
                className="w-full py-6 border border-gray-300 rounded-md focus-visible:ring-2 focus-visible:ring-ring "
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

      {/* Top Section: Design Task */}
      <Accordion
        type="multiple"
        value={openAccordionItems}
        onValueChange={setOpenAccordionItems}
        className="w-full"
      >
        <AccordionItem value="task" className="border-b-0">
          <div
            className={`border rounded ${currentModeConfig?.bgClass} overflow-hidden`}
          >
            <AccordionTrigger className="text-lg font-bold px-6">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">📜</span>
                  <span>設計任務</span>
                </div>
                <div
                  role="button"
                  tabIndex="0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartNewExperiment();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      handleStartNewExperiment();
                    }
                  }}
                  className="text-xs bg-white hover:bg-gray-50 text-gray-600 px-3 py-1 rounded border transition-colors mr-4"
                >
                  新受試者
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 px-6">
              <p className="text-sm  leading-[1.6]">{prompt}</p>
              {isSaved ? (
                <div className="flex items-center gap-6">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      目標受眾：
                    </p>
                    <p className="text-sm">{targetUser}</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      用戶需求：
                    </p>
                    <p className="text-sm">{userNeed}</p>
                  </div>
                  <span
                    className={`${currentModeConfig?.textColorClass} text-xs font-medium`}
                  >
                    已鎖定，可以開始繪圖。
                  </span>
                </div>
              ) : (
                <div className="flex items-end gap-4">
                  <div className="flex-grow flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      目標受眾：
                    </label>
                    <Input
                      type="text"
                      value={targetUser}
                      onChange={(e) =>
                        handleUserInputChange(setTargetUser, e.target.value)
                      }
                      placeholder="您覺得這張椅子是誰來使用？"
                      disabled={isSaved}
                      className={`w-full ${inputFocusStyle} bg-white`}
                    />
                  </div>
                  <div className="flex-grow flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      用戶需求：
                    </label>
                    <Input
                      type="text"
                      value={userNeed}
                      onChange={(e) =>
                        handleUserInputChange(setUserNeed, e.target.value)
                      }
                      placeholder="您覺得這些用戶需要滿足的事情是什麼？"
                      disabled={isSaved}
                      className={`w-full ${inputFocusStyle} bg-white`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSaveInputs}
                      disabled={!isEditing || isSaveButtonDisabled}
                    >
                      儲存
                    </Button>
                    <span className="text-gray-500 text-xs">
                      輸入後請儲存以鎖定情境。
                    </span>
                  </div>
                </div>
              )}
            </AccordionContent>
          </div>
        </AccordionItem>
      </Accordion>

      {/* Bottom Section */}
      <div className="flex-grow grid grid-cols-3 gap-6 min-h-0">
        {/* Bottom-Left: AI Feedback */}
        <div
          className={`col-span-1 border px-6 py-4 rounded ${currentModeConfig?.bgClass} flex flex-col min-h-0`}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">🐻‍❄️ AI 草圖協作夥伴</h2>
            <div className="flex items-center space-x-2">
              {feedbackHistory.length > 0 && (
                <button
                  onClick={handleOpenHistoryModal}
                  className="text-xs bg-white hover:bg-gray-50 text-gray-600 px-3 py-1 rounded border transition-colors"
                >
                  創作歷程
                </button>
              )}
              <span className="text-xs text-gray-500">
                回應次數：{feedbackHistory.length}
              </span>
            </div>
          </div>
          <div className="overflow-y-auto space-y-4 flex-grow">
            {(isLoadingAI || initialFeedbackState === "loading") && (
              <AILoadingIndicator config={currentModeConfig} />
            )}
            {feedbackHistory.length > 0
              ? (() => {
                  const record = feedbackHistory[0];
                  const feedbackConfig = FEEDBACK_MODES[record.feedbackMode];
                  return (
                    <div key={record.docId} className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            feedbackConfig?.dotBg || "bg-gray-400"
                          } text-white`}
                        >
                          AI
                        </div>
                      </div>
                      <div
                        className={`flex-grow p-4 bg-white rounded-md shadow-sm border-l-4 ${feedbackConfig?.borderClass}`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3
                            className={`text-sm font-medium ${feedbackConfig?.textColorClass}`}
                          >
                            回饋 {feedbackHistory.length}
                          </h3>
                          <span className="text-xs text-gray-500">
                            <ClientOnly>
                              {record.timestamp.toLocaleTimeString("zh-TW", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </ClientOnly>
                          </span>
                        </div>
                        {(record.feedbackMode === "sketch-text" ||
                          record.feedbackMode === "sketch-image") &&
                          record.imageUrl && (
                            <div className="mb-3">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">
                                你當前的設計：
                              </h4>
                              <Image
                                src={record.imageUrl}
                                alt="受試者草圖"
                                width={200}
                                height={200}
                                className="w-full max-w-48 max-h-48 object-contain border rounded cursor-pointer hover:opacity-80 transition-opacity mx-auto block"
                                onClick={() =>
                                  window.open(record.imageUrl, "_blank")
                                }
                                title="點擊查看大圖"
                              />
                            </div>
                          )}
                        <div className="mb-3">
                          <h5 className="text-sm font-medium mb-2 text-gray-700">
                            設計建議：
                          </h5>
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
                          {(record.feedbackMode === "sketch-text" ||
                            record.feedbackMode === "task-text") &&
                            record.feedback.analysis &&
                            renderFeedbackDetails(
                              record.feedback.analysis,
                              record.feedbackMode
                            )}
                          <h5 className="text-xs mt-4 text-red-500">
                            {currentModeConfig?.warningMessage}
                          </h5>
                        </div>
                      </div>
                    </div>
                  );
                })()
              : initialFeedbackState === "visible" &&
                !isLoadingAI && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          currentModeConfig?.dotBg || "bg-gray-400"
                        } text-white`}
                      >
                        AI
                      </div>
                    </div>
                    <div
                      className={`flex flex-col flex-grow p-4 bg-white rounded-md shadow-sm border border-l-4 ${currentModeConfig?.borderClass} space-y-6`}
                    >
                      <h4 className="text-sm leading-[1.6]">
                        {currentModeConfig?.welcomeMessage}
                      </h4>
                      <Image
                        src="/initial-design-example.png"
                        alt="初始設計範例照片"
                        width={500}
                        height={300}
                        className="w-full h-auto"
                      />
                      <h4 className="text-xs leading-[1.6] text-red-500">
                        每次繪製完成一張草圖後，再按「獲得回饋」按鈕，取得新的回饋。
                      </h4>
                    </div>
                  </div>
                )}
          </div>
        </div>

        {/* Bottom-Right: Canvas and Controls */}
        <div className="col-span-2 flex flex-col space-y-4">
          <div className="relative flex-grow rounded h-full">
            <CanvasArea
              ref={canvasRef}
              brushOptions={brushOptions}
              onChange={updateCanvasEmptyStatus}
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
              <Button
                onClick={handleEraserMode}
                variant={brushOptions.isEraser ? "secondary" : "default"}
              >
                {brushOptions.isEraser ? "繪圖" : "橡皮擦"}
              </Button>
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
                  currentModeConfig
                    ? `${currentModeConfig.bgClass} ${
                        currentModeConfig.borderClass
                      } ${
                        currentModeConfig.textColorClass
                      } hover:bg-${currentModeConfig.bgClass.replace(
                        "-50",
                        "-100"
                      )}`
                    : "bg-gray-300 text-gray-700"
                }`}
              >
                {isLoadingAI ? "AI 分析中..." : "獲取回饋"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={handleCloseHistoryModal}
        history={feedbackHistory}
        currentPage={historyPageIndex}
        onNext={handleHistoryNext}
        onPrev={handleHistoryPrev}
        renderFeedbackDetails={renderFeedbackDetails}
      />
    </div>
  );
}
