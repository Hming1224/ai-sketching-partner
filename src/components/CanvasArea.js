// CanvasArea.js
"use client";

import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { getStroke } from "perfect-freehand";
import getFlatSvgPathFromStroke from "@/lib/getFlatSvgPathFromStroke";

// ✨ 讓元件能夠接收 props
const CanvasArea = forwardRef(({ brushOptions, onChange }, ref) => {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [strokes, setStrokes] = useState([]);
  const [undoneStrokes, setUndoneStrokes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // 提供給 parent 的操作方法
  useImperativeHandle(ref, () => ({
    clearCanvas() {
      setPoints([]);
      setStrokes([]);
      setUndoneStrokes([]);
      // ✨ 狀態改變時通知父元件
      if (onChange) onChange();
    },
    downloadCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = "drawing.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    },
    async getCanvasImageBlob() {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/png")
      );
    },
    undo() {
      setStrokes((prev) => {
        const newStrokes = [...prev];
        const undone = newStrokes.pop();
        if (undone) {
          setUndoneStrokes((u) => [...u, undone]);
          // ✨ 狀態改變時通知父元件
          if (onChange) onChange();
        }
        return newStrokes;
      });
    },
    redo() {
      setUndoneStrokes((prev) => {
        const undone = [...prev];
        const restored = undone.pop();
        if (restored) {
          setStrokes((s) => [...s, restored]);
          // ✨ 狀態改變時通知父元件
          if (onChange) onChange();
        }
        return undone;
      });
    },
    // ✨ 新增一個判斷畫布是否為空的方法
    isEmpty: () => strokes.length === 0 && points.length === 0,
  }));

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;
    return [
      (e.clientX - bounds.left) * scaleX,
      (e.clientY - bounds.top) * scaleY,
      e.pressure ?? 0.5,
    ];
  };

  const handlePointerDown = (e) => {
    setPoints([getCanvasPoint(e)]);
    setIsDrawing(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    setPoints((prev) => [...prev, getCanvasPoint(e)]);
  };

  const handlePointerUp = () => {
    if (points.length > 0) {
      setStrokes((prev) => [...prev, { points, options: { ...brushOptions } }]);
      setPoints([]);
      setUndoneStrokes([]); // 清空 redo stack
      // ✨ 狀態改變時通知父元件
      if (onChange) onChange();
    }
    setIsDrawing(false);
  };

  // 繪製所有筆畫
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (pts, options) => {
      const stroke = getStroke(pts, options);
      const path = getFlatSvgPathFromStroke(stroke);
      const path2D = new Path2D(path);
      ctx.fillStyle = options.color || "black";
      ctx.fill(path2D);
    };

    strokes.forEach((s) => drawStroke(s.points, s.options));
    if (points.length > 0) {
      drawStroke(points, brushOptions);
    }
  }, [strokes, points, brushOptions]);

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={400}
      className="w-full border bg-white touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
});

export default CanvasArea;