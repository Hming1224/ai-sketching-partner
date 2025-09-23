"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const HistoryModal = ({
  isOpen,
  onClose,
  history,
  currentPage,
  onNext,
  onPrev,
  renderFeedbackDetails, // 接收渲染函式
}) => {
  if (!isOpen || !history || history.length === 0) return null;

  const totalPages = history.length;

  // Reverse the history to display in chronological order
  const reversedHistory = [...history].reverse();

  let leftContent, rightImage, leftTitle, rightTitle, feedbackMode;

  // The right side is always the user's sketch for the current page number
  rightImage = reversedHistory[currentPage]?.imageUrl;
  rightTitle = `你的草圖 (第 ${currentPage + 1} 張)`;

  if (currentPage === 0) {
    // The first page's left side is the initial example
    leftContent = "/initial-design-example.png";
    leftTitle = "AI 初始範例";
  } else {
    // Subsequent pages show the AI feedback that preceded the sketch
    const prevFeedback = reversedHistory[currentPage - 1];
    feedbackMode = prevFeedback?.feedbackMode;

    if (feedbackMode?.includes("image")) {
      leftContent = prevFeedback?.feedback.suggestions; // Correctly get the image suggestion
      leftTitle = `AI 的圖像建議 (回饋 ${currentPage})`;
    } else if (feedbackMode?.includes("text")) {
      leftContent = prevFeedback?.feedback.analysis; // Get the text analysis
      leftTitle = `AI 的文字建議 (回饋 ${currentPage})`;
    }
  }

  const isLeftImage =
    typeof leftContent === "string" &&
    (leftContent.startsWith("/") ||
      leftContent.startsWith("http") ||
      leftContent.startsWith("data:"));

  return (
    <div className="fixed inset-0 bg-gray-700 bg-opacity-75 flex items-center justify-center z-50 p-8">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-6xl flex flex-col p-6 relative">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-800">創作歷程</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-grow flex items-stretch justify-center gap-8">
          {/* Left Side: AI Content */}
          <div className="w-1/2 h-full flex flex-col p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">{leftTitle}</h3>
            <div className="relative w-full flex-grow overflow-y-auto p-2">
              {isLeftImage ? (
                <Image
                  src={leftContent}
                  alt={leftTitle}
                  fill
                  style={{ objectFit: "contain" }}
                  className="rounded-md"
                />
              ) : leftContent ? (
                renderFeedbackDetails(leftContent, feedbackMode)
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  沒有建議內容
                </div>
              )}
            </div>
          </div>

          {/* Right Side: User Sketch */}
          <div className="w-1/2 h-full flex flex-col p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">{rightTitle}</h3>
            <div className="relative w-full flex-grow">
              {rightImage ? (
                <Image
                  src={rightImage}
                  alt={rightTitle}
                  fill
                  style={{ objectFit: "contain" }}
                  className="rounded-md"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  (尚未繪製)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <Button onClick={onPrev} disabled={currentPage === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" /> 上一頁
          </Button>
          <span className="text-sm text-gray-600">
            第 {currentPage + 1} / {totalPages} 頁
          </span>
          <Button onClick={onNext} disabled={currentPage >= totalPages - 1}>
            下一頁 <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
