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

const CanvasArea = forwardRef(({ brushOptions, onChange }, ref) => {
  // 這裡也要確保有 onChange prop
  const containerRef = useRef(null);
  const mainCanvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [drawingHistory, setDrawingHistory] = useState([]);
  const [undoneHistory, setUndoneHistory] = useState([]);
  const changeListeners = useRef(new Set());

  // 使用 useRef 來儲存 onChange 回調，避免不必要的 re-renders
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // 更新 notifyChange 函式
  const notifyChange = useCallback(() => {
    if (onChangeRef.current) {
      const isEmpty = drawingHistory.length === 0 && points.length === 0;
      onChangeRef.current(isEmpty);
    }
  }, [drawingHistory, points]);

  const drawStroke = useCallback((ctx, pts, options, targetCanvasId) => {
    // 確保 points 至少有兩個點才能構成筆畫
    if (!pts || pts.length < 2) return;

    const stroke = getStroke(pts, options);
    const path = getFlatSvgPathFromStroke(stroke);
    const path2D = new Path2D(path);

    if (options.isEraser) {
      if (targetCanvasId === "drawing-canvas") {
        // 在頂層畫布預覽橡皮擦（半透明灰色）
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(128, 128, 128, 0.5)"; // 半透明灰色
        ctx.fill(path2D);
      } else if (targetCanvasId === "main-canvas") {
        // 在底層畫布實際擦除
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "black"; // 這裡的顏色不重要，因為 destination-out 只看形狀
        ctx.fill(path2D);
        ctx.globalCompositeOperation = "source-over"; // 立即恢復預設
      }
    } else {
      // 繪製筆畫
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = options.color || "black";
      ctx.fill(path2D);
    }
  }, []);

  // 1. ResizeObserver 監聽容器尺寸變化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        // 確保尺寸大於 0，避免無限迴圈或錯誤渲染
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // 2. 當 dimensions 或 drawingHistory 改變時，重繪底層畫布
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext("2d");

    // 清除整個畫布並重新設定背景
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    // 確保背景為白色，以免透明導致顯示為黑色
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

    drawingHistory.forEach((s) =>
      drawStroke(ctx, s.points, s.options, mainCanvas.id)
    );
    notifyChange();
  }, [drawingHistory, drawStroke, notifyChange, dimensions]); // <-- 確保 dimensions 也在依賴陣列中

  // 3. 處理即時繪圖
  useEffect(() => {
    const drawingCanvas = drawingCanvasRef.current;
    if (!drawingCanvas) return;
    const ctx = drawingCanvas.getContext("2d");

    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height); // 清除頂層畫布

    if (isDrawing && points.length > 0) {
      drawStroke(ctx, points, brushOptions, drawingCanvas.id);
    }
  }, [isDrawing, points, brushOptions, drawStroke, dimensions]); // <-- 確保 dimensions 也在依賴陣列中

  // ... (其他 useImperativeHandle, handlePointerDown/Move/Up 邏輯不變)
  useImperativeHandle(ref, () => ({
    addChangeListener: (listener) => {
      changeListeners.current.add(listener);
    },
    removeChangeListener: (listener) => {
      changeListeners.current.delete(listener);
    },
    undo: () => {
      if (drawingHistory.length > 0) {
        const lastStroke = drawingHistory[drawingHistory.length - 1];
        setUndoneHistory((prev) => [lastStroke, ...prev]);
        setDrawingHistory((prev) => prev.slice(0, -1));
      }
    },
    redo: () => {
      if (undoneHistory.length > 0) {
        const nextStroke = undoneHistory[0];
        setDrawingHistory((prev) => [...prev, nextStroke]);
        setUndoneHistory((prev) => prev.slice(1));
      }
    },
    clearCanvas: () => {
      setDrawingHistory([]);
      setUndoneHistory([]);
      setPoints([]);
      const mainCanvas = mainCanvasRef.current;
      const drawingCanvas = drawingCanvasRef.current;
      if (mainCanvas) {
        const ctx = mainCanvas.getContext("2d");
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        ctx.fillStyle = "white"; // 確保清除後是白色背景
        ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
      }
      if (drawingCanvas) {
        drawingCanvas
          .getContext("2d")
          .clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      }
    },
    downloadCanvas: () => {
      const mainCanvas = mainCanvasRef.current;
      if (mainCanvas) {
        const image = mainCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = "sketch.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    getCanvasImageBlob: () => {
      return new Promise((resolve) => {
        const mainCanvas = mainCanvasRef.current;
        if (mainCanvas) {
          mainCanvas.toBlob((blob) => {
            resolve(blob);
          }, "image/png");
        } else {
          resolve(null);
        }
      });
    },
    isDrawing: () => isDrawing,
    isEmpty: () => drawingHistory.length === 0 && points.length === 0,
    getDrawingData: () => ({
      history: drawingHistory,
      canvas: mainCanvasRef.current,
    }),
  }));

  const getCanvasCoords = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  };

  const handlePointerDown = (e) => {
    // 如果事件來自觸控 (手指或手掌)，則直接忽略，不開始繪圖
    if (e.pointerType === "touch") {
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setIsDrawing(true);
    const coords = getCanvasCoords(e, drawingCanvasRef.current);
    setPoints([{ x: coords[0], y: coords[1], pressure: e.pressure }]);
    setUndoneHistory([]); // 開始新筆畫時清除重做歷史
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e, drawingCanvasRef.current);
    setPoints((prev) => [
      ...prev,
      { x: coords[0], y: coords[1], pressure: e.pressure },
    ]);
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (points.length > 0) {
      setDrawingHistory((prev) => [
        ...prev,
        { points: points, options: brushOptions },
      ]);
      setPoints([]); // 清空當前繪圖點
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative rounded">
      <canvas
        ref={mainCanvasRef}
        id="main-canvas"
        width={dimensions.width}
        height={dimensions.height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 0,
          background: "white", // 這裡的背景色很重要，確保 canvas 元素本身有白色背景
        }}
        className="w-full h-full border touch-none select-none rounded"
      />
      <canvas
        ref={drawingCanvasRef}
        id="drawing-canvas"
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full touch-none select-none rounded"
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
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
});

CanvasArea.displayName = "CanvasArea";

export default CanvasArea;
