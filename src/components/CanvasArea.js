import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import getStroke from "perfect-freehand";
import getSvgPathFromStroke from "@/lib/getSvgPathFromStroke";

const MIN_PRESSURE = 0.015;

function throttle(callback, delay) {
  let previousCall = new Date().getTime();
  return function() {
    const time = new Date().getTime();

    if ((time - previousCall) >= delay) {
      previousCall = time;
      callback.apply(null, arguments);
    }
  };
}

const CanvasArea = forwardRef(({ brushOptions, onChange }, ref) => {
  const mainCanvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [activeStroke, setActiveStroke] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const handleCanvasChange = useCallback(() => {
    if (onChange) {
      onChange();
    }
  }, [onChange]);

  const resizeCanvases = useCallback(() => {
    const mainCanvas = mainCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    if (!mainCanvas?.parentElement || !drawingCanvas) return;

    const { width, height } = mainCanvas.parentElement.getBoundingClientRect();

    if (mainCanvas.width !== width || mainCanvas.height !== height) {
      mainCanvas.width = width;
      mainCanvas.height = height;
      drawingCanvas.width = width;
      drawingCanvas.height = height;
      setStrokes(s => [...s]);
    }
  }, []);

  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => {
      if (stroke.points.length > 0) {
        const pathData = getSvgPathFromStroke(getStroke(stroke.points, stroke));
        const path = new Path2D(pathData);
        ctx.fillStyle = stroke.isEraser ? "#FFFFFF" : stroke.color;
        ctx.fill(path);
      }
    });
  }, [strokes]);

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeStroke && activeStroke.points.length > 0) {
      const pathData = getSvgPathFromStroke(
        getStroke(activeStroke.points, activeStroke)
      );
      const path = new Path2D(pathData);

      if (activeStroke.isEraser) {
        ctx.fillStyle = "rgba(128, 128, 128, 0.5)"; // Gray trail for active eraser
      } else {
        ctx.fillStyle = activeStroke.color;
      }
      
      ctx.fill(path);
    }
  }, [activeStroke]);

  const getCanvasPosition = useCallback((e) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== 0 || e.pointerType === 'touch') return;
      setIsDrawing(true);
      const { x, y } = getCanvasPosition(e);

      let compensatedPressure = e.pressure;
      if (e.pressure > 0 && e.pressure < MIN_PRESSURE) {
        compensatedPressure = MIN_PRESSURE;
      }

      setActiveStroke({
        points: [{ x, y, pressure: compensatedPressure }],
        ...brushOptions,
      });
    },
    [brushOptions, getCanvasPosition]
  );

  const handlePointerMove = useCallback(
    throttle((e) => {
      if (!isDrawing) return;
      e.preventDefault();

      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

      setActiveStroke((prev) => {
        if (!prev) return null;
        const newPoints = events.map((event) => {
          let compensatedPressure = event.pressure;
          if (event.pressure > 0 && event.pressure < MIN_PRESSURE) {
            compensatedPressure = MIN_PRESSURE;
          }
          const { x, y } = getCanvasPosition(event);
          return { x, y, pressure: compensatedPressure };
        });
        return {
          ...prev,
          points: [...prev.points, ...newPoints],
        };
      });
    }, 16),
    [isDrawing, getCanvasPosition]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    setActiveStroke((currentActiveStroke) => {
      if (currentActiveStroke && currentActiveStroke.points.length > 0) {
        setStrokes((prevStrokes) => {
          const newStrokes = [...prevStrokes, currentActiveStroke];
          setHistory((prevHistory) => {
            const newHistory = [
              ...prevHistory.slice(0, historyIndex + 1),
              newStrokes,
            ];
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
          });
          return newStrokes;
        });
      }
      return null;
    });

    handleCanvasChange();
  }, [isDrawing, handleCanvasChange, history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex]);
      handleCanvasChange();
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex]);
      handleCanvasChange();
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
    setActiveStroke(null);
    setHistory([[]]);
    setHistoryIndex(0);
    handleCanvasChange();
  };

  const downloadCanvas = () => {
    const canvas = mainCanvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "sketch.png";
    link.click();
  };

  const getDrawingData = () => {
    return {
      history: strokes,
      canvas: mainCanvasRef.current,
    };
  };

  const isEmpty = () => {
    return strokes.length === 0 && !activeStroke;
  };

  useImperativeHandle(ref, () => ({
    undo,
    redo,
    clearCanvas,
    downloadCanvas,
    getDrawingData,
    isEmpty,
    isDrawing: () => isDrawing,
    resizeCanvas: resizeCanvases,
    addChangeListener: (listener) => {},
    removeChangeListener: (listener) => {},
  }));

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    resizeCanvases();
    window.addEventListener("resize", resizeCanvases);

    return () => {
      window.removeEventListener("resize", resizeCanvases);
    };
  }, [resizeCanvases]);

  return (
    <div
      className="relative w-full h-full touch-none select-none bg-white rounded overflow-hidden border border-gray-300"
      style={{ width: "100%", height: "100%", userSelect: "none", WebkitUserSelect: "none" }}
    >
      <canvas
        ref={mainCanvasRef}
        className="absolute top-0 left-0"
      />
      <canvas
        ref={drawingCanvasRef}
        className="absolute top-0 left-0"
        onPointerDown={handlePointerDown}
      />
    </div>
  );
});

CanvasArea.displayName = "CanvasArea";

export default CanvasArea;