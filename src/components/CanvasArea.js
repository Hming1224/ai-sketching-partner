import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import getStroke from "perfect-freehand";
import { getSvgPathFromStroke } from "@/lib/getSvgPathFromStroke";

const CanvasArea = forwardRef(({ brushOptions, onChange }, ref) => {
  const mainCanvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [activeStroke, setActiveStroke] = useState(null);
  const isDrawingRef = useRef(false);

  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);

  const handleCanvasChange = useCallback(() => {
    if (onChange) {
      onChange();
    }
  }, [onChange]);

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
      ctx.fillStyle = activeStroke.isEraser ? "#FFFFFF" : activeStroke.color;
      ctx.fill(path);
    }
  }, [activeStroke]);

  const getCanvasPosition = (e) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    isDrawingRef.current = true;
    const { x, y } = getCanvasPosition(e);
    const newStroke = {
      points: [{ x, y, pressure: e.pressure }],
      ...brushOptions,
    };
    setActiveStroke(newStroke);
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const { pressure, tiltX, tiltY } = e;
    setDebugInfo({ pressure: pressure.toFixed(4), tiltX, tiltY });

    const { x, y } = getCanvasPosition(e);
    setActiveStroke((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, { x, y, pressure: e.pressure }],
      };
    });
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (activeStroke && activeStroke.points.length > 1) {
      setStrokes((prevStrokes) => {
        const newStrokes = [...prevStrokes, activeStroke];
        const newHistory = [...history.slice(0, historyIndex + 1), newStrokes];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        return newStrokes;
      });
    }
    setActiveStroke(null);
    setDebugInfo(null);
    handleCanvasChange();
  };

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
    addChangeListener: (listener) => {},
    removeChangeListener: (listener) => {},
  }));

  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;

    const resizeCanvases = () => {
      const { width, height } = mainCanvas.parentElement.getBoundingClientRect();
      mainCanvas.width = width;
      mainCanvas.height = height;
      drawingCanvas.width = width;
      drawingCanvas.height = height;
      setStrokes(strokes => [...strokes]);
    };

    window.addEventListener("resize", resizeCanvases);
    resizeCanvases();

    const handlePointerLeave = (e) => {
      if (isDrawingRef.current) {
        handlePointerUp(e);
      }
    };
    drawingCanvas.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.removeEventListener("resize", resizeCanvases);
      drawingCanvas.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [strokes]);

  return (
    <div
      className="relative w-full h-full touch-none bg-white rounded-lg overflow-hidden"
      style={{ width: "100%", height: "100%" }}
    >
      {debugInfo && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '5px',
          zIndex: 100,
          fontSize: '12px',
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}>
          <p>Pressure: {debugInfo.pressure}</p>
          <p>TiltX: {debugInfo.tiltX}</p>
          <p>TiltY: {debugInfo.tiltY}</p>
        </div>
      )}
      <canvas
        ref={mainCanvasRef}
        className="absolute top-0 left-0"
      />
      <canvas
        ref={drawingCanvasRef}
        className="absolute top-0 left-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
});

CanvasArea.displayName = "CanvasArea";

export default CanvasArea;
