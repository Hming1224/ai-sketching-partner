"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export default function BrushSettingsPanel({
  options = {},
  onChange,
  isEraser,
}) {
  const panelTitle = isEraser ? "橡皮擦設定" : "筆刷設定";

  return (
    <div className="border px-4 py-2 rounded bg-gray-100">
      {/* [修改] 移除 defaultValue="brush-settings"，讓手風琴預設關閉 */}
      <Accordion type="single" collapsible>
        <AccordionItem value="brush-settings" className="border-b-0">
          <AccordionTrigger className="text-lg font-bold focus:no-underline py-3">
            <div className="flex items-center space-x-3">
              <span className="text-xl">{isEraser ? "🧽" : "✏️"}</span>
              <span>{panelTitle}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-6">
            {/* ... 內部滑桿等內容不變 ... */}
            <div className="pt-2">
              <Label className="mb-2 block">大小 (Size)</Label>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[options.size ?? 8]}
                onValueChange={([v]) => onChange("size", v)}
              />
            </div>
            {!isEraser && (
              <>
                <div>
                  <Label className="mb-2 block">筆尖粗細 (Thinning)</Label>
                  <Slider
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={[options.thinning ?? 0.5]}
                    onValueChange={([v]) => onChange("thinning", v)}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">簡化 (Streamline)</Label>
                  <Slider
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={[options.streamline ?? 0.5]}
                    onValueChange={([v]) => onChange("streamline", v)}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">平滑度 (Smoothing)</Label>
                  <Slider
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={[options.smoothing ?? 0.5]}
                    onValueChange={([v]) => onChange("smoothing", v)}
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <Label>筆刷顏色 (Color)</Label>
                  <input
                    type="color"
                    value={options.color ?? "#000000"}
                    onChange={(e) => onChange("color", e.target.value)}
                    className="w-10 h-10 p-1 border-none rounded-md cursor-pointer"
                    style={{ backgroundColor: options.color ?? "#000000" }}
                  />
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
