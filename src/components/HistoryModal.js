"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function HistoryModal({
  isOpen,
  onClose,
  history,
  currentPage,
  onNext,
  onPrev,
  renderFeedbackDetails,
  targetAudience,
  userNeeds,
}) {
  if (!isOpen) return null;

  const totalPages = history.length;

  // Determine content for the Right Panel (User's Sketch)
  const rightRecord = history[currentPage];
  const rightImage = rightRecord?.userSketchUrl;
  const rightTitle = `我的草圖 ${rightRecord?.sketchCount || ''}`;

  // Determine content for the Left Panel (AI Suggestion)
  let leftContent, leftTitle, isLeftImage, feedbackMode;

  if (currentPage === 0) {
    leftTitle = "初始設計範例";
    leftContent = "/initial-design-example.png";
    isLeftImage = true;
    feedbackMode = null; // No feedback details to render
  } else {
    const leftRecord = history[currentPage - 1];
    const feedback = leftRecord?.feedback;
    leftTitle = "AI建議";
    isLeftImage = feedback?.type === "image";
    leftContent = isLeftImage ? feedback.suggestions : feedback?.analysis;
    feedbackMode = leftRecord?.selectedMode;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-6xl h-5/6 flex flex-col">
        <div className="flex justify-between items-center pb-4 mb-4 border-b">
          <h2 className="text-2xl font-bold">創作歷程</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 rounded-lg flex flex-wrap gap-x-8">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-gray-600">環境：</p>
            <p className="text-sm text-gray-800">長照中心</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-gray-600">目標受眾：</p>
            <p className="text-sm text-gray-800">{targetAudience || '尚未設定'}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-gray-600">用戶需求：</p>
            <p className="text-sm text-gray-800">{userNeeds || "尚未設定"}</p>
          </div>
        </div>

        <div className="flex-grow flex gap-4 overflow-hidden">
          {/* Left Side: AI Content */}
          <div className="w-1/2 h-full flex flex-col p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">
              {leftTitle}
            </h3>
            <div className="relative w-full flex-grow overflow-y-auto p-2">
              {isLeftImage && leftContent ? (
                <Image
                  src={leftContent}
                  alt={leftTitle}
                  fill
                  style={{ objectFit: "contain" }}
                  className="rounded-md"
                />
              ) : !isLeftImage && leftContent ? (
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
            <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">
              {rightTitle}
            </h3>
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
}
