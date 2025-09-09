"use client";

import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { getStroke } from "perfect-freehand";
import getFlatSvgPathFromStroke from "@/lib/getFlatSvgPathFromStroke";

const CanvasArea = forwardRef(({ brushOptions }, ref) => {
  const mainCanvasRef = useRef(null); // 底層畫布，用於儲存已完成的筆畫
  const drawingCanvasRef = useRef(null); // 頂層畫布，用於即時繪圖
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [drawingHistory, setDrawingHistory] = useState([]);
  const [undoneHistory, setUndoneHistory] = useState([]);

  const changeListeners = useRef(new Set());

  const notifyChange = useCallback(() => {
    // 透過 drawingHistory 和 points 的長度來判斷畫布是否為空
    const isEmpty = drawingHistory.length === 0 && points.length === 0;
    changeListeners.current.forEach((listener) => listener(isEmpty));
  }, [drawingHistory, points]);

  // [方案一實作] drawStroke 函式，處理畫筆與橡皮擦的繪製邏輯
  const drawStroke = useCallback((ctx, pts, options) => {
    if (options.isEraser) {
      // 如果是橡皮擦模式
      if (ctx.canvas.id === "drawing-canvas") {
        // 在頂層畫布 (drawing-canvas) 上，我們畫一個半透明的預覽軌跡
        ctx.globalCompositeOperation = "source-over"; // 使用正常的繪製模式
        const stroke = getStroke(pts, options);
        const path = getFlatSvgPathFromStroke(stroke);
        const path2D = new Path2D(path);
        // 繪製一個半透明的灰色軌跡作為橡皮擦預覽
        ctx.fillStyle = "rgba(128, 128, 128, 0.5)";
        ctx.fill(path2D);
      } else {
        // 在底層畫布 (main-canvas) 上，我們才真正執行擦除操作
        ctx.globalCompositeOperation = "destination-out";
        const stroke = getStroke(pts, options);
        const path = getFlatSvgPathFromStroke(stroke);
        const path2D = new Path2D(path);
        ctx.fillStyle = "#000000"; // 顏色不重要，但需要填充以「挖洞」
        ctx.fill(path2D);
      }
    } else {
      // 畫筆模式維持原樣
      ctx.globalCompositeOperation = "source-over";
      const stroke = getStroke(pts, options);
      const path = getFlatSvgPathFromStroke(stroke);
      const path2D = new Path2D(path);
      ctx.fillStyle = options.color || "black";
      ctx.fill(path2D);
    }
  }, []);

  // 此 Effect 只在 drawingHistory 改變時 (undo/redo/clear) 執行，用於重繪底層畫布
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory.forEach((s) => drawStroke(ctx, s.points, s.options));
    notifyChange();
  }, [drawingHistory, drawStroke, notifyChange]);

  // 此 Effect 只用於繪製當前筆畫到頂層畫布，效能極高
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isDrawing && points.length > 0) {
      drawStroke(ctx, points, brushOptions);
    }
  }, [isDrawing, points, brushOptions, drawStroke]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => drawingHistory.length === 0,
    isDrawing: () => isDrawing,
    addChangeListener: (listener) => {
      changeListeners.current.add(listener);
    },
    removeChangeListener: (listener) => {
      changeListeners.current.delete(listener);
    },
    clearCanvas() {
      setDrawingHistory([]);
      setUndoneHistory([]);
      const mainCanvas = mainCanvasRef.current;
      const drawingCanvas = drawingCanvasRef.current;
      if (mainCanvas && drawingCanvas) {
        mainCanvas
          .getContext("2d")
          .clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        drawingCanvas
          .getContext("2d")
          .clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      }
      notifyChange();
    },
    // 私有輔助函式，用於合併圖層
    _getCombinedCanvas() {
      const canvas = document.createElement("canvas");
      canvas.width = mainCanvasRef.current.width;
      canvas.height = mainCanvasRef.current.height;
      const ctx = canvas.getContext("2d");
      // 先繪製底層，再繪製頂層（頂層通常是空的，除非正在繪圖中）
      ctx.drawImage(mainCanvasRef.current, 0, 0);
      ctx.drawImage(drawingCanvasRef.current, 0, 0);
      return canvas;
    },
    downloadCanvas() {
      if (this.isEmpty()) return;
      const combinedCanvas = this._getCombinedCanvas();
      const link = document.createElement("a");
      link.download = "design-sketch.png";
      link.href = combinedCanvas.toDataURL("image/png");
      link.click();
    },
    async getCanvasImageBlob() {
      if (this.isEmpty()) return null;
      const combinedCanvas = this._getCombinedCanvas();
      return new Promise((resolve) =>
        combinedCanvas.toBlob((blob) => resolve(blob), "image/png")
      );
    },
    undo() {
      if (drawingHistory.length > 0) {
        const lastStroke = drawingHistory[drawingHistory.length - 1];
        setUndoneHistory((prev) => [...prev, lastStroke]);
        setDrawingHistory((prev) => prev.slice(0, -1));
      }
    },
    redo() {
      if (undoneHistory.length > 0) {
        const lastUndoneStroke = undoneHistory[undoneHistory.length - 1];
        setDrawingHistory((prev) => [...prev, lastUndoneStroke]);
        setUndoneHistory((prev) => prev.slice(0, -1));
      }
    },
  }));

  const getCanvasPoint = (e) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return [0, 0, 0.5];
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
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setPoints([getCanvasPoint(e)]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    setPoints((prev) => [...prev, getCanvasPoint(e)]);
  };

  const handlePointerUp = () => {
    if (!isDrawing || points.length === 0) {
      setIsDrawing(false);
      return;
    }

    // 將頂層畫布的軌跡「印」到底層
    const mainCtx = mainCanvasRef.current.getContext("2d");
    drawStroke(mainCtx, points, brushOptions);

    // 更新歷史紀錄
    const newStroke = { points, options: { ...brushOptions } };
    setDrawingHistory((prev) => [...prev, newStroke]);

    // 清空頂層畫布和當前筆畫數據
    setIsDrawing(false);
    setPoints([]);
    setUndoneHistory([]); // 新筆畫會清空 redo 歷史
  };

  return (
    // 使用一個容器來疊放兩個 canvas，並加上 id
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "500 / 400",
      }}
    >
      <canvas
        ref={mainCanvasRef}
        id="main-canvas" // 為底層畫布加上 ID
        width={500}
        height={400}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 0,
          background: "white",
        }}
        className="w-full border"
      />
      <canvas
        ref={drawingCanvasRef}
        id="drawing-canvas" // 為頂層畫布加上 ID
        width={500}
        height={400}
        className="w-full touch-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
          background: "transparent",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp} // 處理滑鼠移出畫布的情況
      />
    </div>
  );
});

// 為 forwardRef 元件加上 displayName 有助於 React DevTools 除錯
CanvasArea.displayName = "CanvasArea";

export default CanvasArea;
