"use client";

import { useRef, useState } from "react";
import CanvasArea from "@/components/CanvasArea";
import BrushSettingsPanel from "@/components/BrushSettingsPanel";
import { Button } from "@/components/ui/button";
import { saveAs } from "file-saver";

export default function Home() {
  const canvasRef = useRef();
  const [prompt, setPrompt] = useState(
    "請您繪製一張能夠在長照中心使用的椅子，您可以從不同設計面向去思考這張椅子的功能、結構、材質等，任何發想形式或呈現手法不侷限，您可以嘗試想像在這樣環境中會有什麼樣使用者，他們會如何使用這樣椅子，請您盡可能繪製越多草圖越好。"
  );
  const [aiFeedback, setAiFeedback] = useState(null);

  const [brushOptions, setBrushOptions] = useState({
    size: 8,
    thinning: 0.5,
    streamline: 0.5,
    smoothing: 0.5,
    color: "#000000", // 預設黑色
  });

  const handleUndo = () => {
    canvasRef.current?.undo();
  };

  const handleRedo = () => {
    canvasRef.current?.redo();
  };

  const handleClear = () => {
    canvasRef.current?.clearCanvas();
  };

  const handleDownload = () => {
    canvasRef.current?.downloadCanvas();
  };

  const handleSendToAI = async () => {
    const blob = await canvasRef.current?.getCanvasImageBlob();
    if (!blob) return;

    const formData = new FormData();
    formData.append("image", blob);
    formData.append("prompt", prompt);

    const res = await fetch("/api/feedback", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      console.error("AI 回饋 API 請求失敗");
      return;
    }

    const data = await res.json();
    setAiFeedback(data.feedback);
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-6">
      {/* 左側：任務區、筆刷設定、畫布、控制按鈕 */}
      <div className="space-y-4">
        {/* 任務說明 */}
        <div className="border p-4 rounded bg-gray-50">
          <h2 className="text-lg font-bold mb-2">設計任務</h2>
          <p>{prompt}</p>
        </div>

        {/* 筆刷設定區（Accordion 形式） */}
        <BrushSettingsPanel
          options={brushOptions}
          onChange={(key, value) =>
            setBrushOptions((prev) => ({ ...prev, [key]: value }))
          }
        />

        {/* 畫布 */}
        <CanvasArea ref={canvasRef} brushOptions={brushOptions} />

        {/* 控制按鈕 */}
        <div className="flex gap-2">
          <Button onClick={handleUndo}>返回</Button>
          <Button onClick={handleRedo}>重做</Button>
          <Button onClick={handleClear}>清除畫布</Button>
          <Button onClick={handleDownload}>下載繪圖</Button>
          <Button onClick={handleSendToAI}>送出給 AI 回饋</Button>
        </div>
      </div>

      {/* 右側：AI 回饋區塊 */}
      <div className="border p-4 rounded bg-gray-100">
        <h2 className="text-lg font-bold mb-2">AI 回饋內容</h2>
        {aiFeedback ? (
          <p>{aiFeedback}</p>
        ) : (
          <p className="text-gray-500">尚未取得回饋。</p>
        )}
      </div>
    </div>
  );
}
