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

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSendToAI = async () => {
    const blob = await canvasRef.current?.getCanvasImageBlob();
    if (!blob) {
      console.error("無法取得畫布影像");
      return;
    }

    const fileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
      });
    };

    const base64Image = await fileToBase64(blob);
    const cleanedBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const payload = {
      taskDescription: prompt,
      imageBase64: cleanedBase64,
      mode: "task-image",
    };

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("AI 回饋 API 錯誤：", data?.error);
        return;
      }

      setAiFeedback(data.feedback);
    } catch (error) {
      console.error("發送 AI 回饋失敗：", error);
    }
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
          aiFeedback.split("\n\n").map((section, idx) => {
            // 解析：以第一個句號分成標題 + 內文
            const [rawTitle, ...rest] = section.trim().split(/(?<=。)/); // 拆出第一個句號前的標題
            const title = rawTitle?.trim();
            const content = rest.join("").trim();

            return (
              <div key={idx} className="mb-6">
                <h3 className="text-base font-semibold mb-1">{title}</h3>
                <p className="text-base leading-relaxed text-gray-800">
                  {content}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-gray-500">尚未取得回饋。</p>
        )}
      </div>
    </div>
  );
}
