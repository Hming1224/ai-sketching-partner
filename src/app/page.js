"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { saveAs } from "file-saver";

export default function Home() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState(
    "請您繪製一張能夠在長照中心使用的椅子，您可以從不同設計面向去思考這張椅子的功能、結構、材質等，任何發想形式或呈現手法不侷限，您可以嘗試想像在這樣環境中會有什麼樣使用者，他們會如何使用這樣椅子，請您盡可能繪製越多草圖越好。"
  );
  const [aiFeedback, setAiFeedback] = useState(null);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    saveAs(dataUrl, "drawing.png");
  };

  const sendToAI = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const blob = await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });

    if (!blob) {
      console.error("Canvas toBlob failed");
      return;
    }

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
      <div className="space-y-4">
        <div className="border p-4 rounded bg-gray-50">
          <h2 className="text-lg font-bold mb-2">設計任務</h2>
          <p>{prompt}</p>
        </div>

        <canvas
          ref={canvasRef}
          width={500}
          height={400}
          className="border bg-white touch-none"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />

        <div className="flex gap-2">
          <Button onClick={clearCanvas}>清除畫布</Button>
          <Button onClick={downloadImage}>下載繪圖</Button>
          <Button onClick={sendToAI}>送出給 AI 回饋</Button>
        </div>
      </div>

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
