"use client";

import { useCallback } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export default function BrushSettingsPanel({ options = {}, onChange }) {
  const handleChange = useCallback(
    (key, value) => {
      onChange?.(key, value); // 正確傳遞 key/value
    },
    [onChange]
  );

  return (
    <div className="border p-4 rounded bg-gray-50">
      <Accordion type="single" collapsible defaultValue="">
        <AccordionItem value="brush-settings">
          <AccordionTrigger>✏️ 筆刷設定</AccordionTrigger>
          <AccordionContent className="space-y-4 mt-4">
            {/* 筆刷大小 */}
            <div>
              <Label>大小（size）</Label>
              <Slider
                min={1}
                max={32}
                step={1}
                value={[options.size ?? 8]}
                onValueChange={([v]) => handleChange("size", v)}
              />
            </div>

            {/* 壓力感知 */}
            <div>
              <Label>壓力感知（thinning）</Label>
              <Slider
                min={-1}
                max={1}
                step={0.01}
                value={[options.thinning ?? 0.5]}
                onValueChange={([v]) => handleChange("thinning", v)}
              />
            </div>

            {/* 滑順度 */}
            <div>
              <Label>滑順度（streamline）</Label>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[options.streamline ?? 0.5]}
                onValueChange={([v]) => handleChange("streamline", v)}
              />
            </div>

            {/* 平滑度 */}
            <div>
              <Label>平滑度（smoothing）</Label>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[options.smoothing ?? 0.5]}
                onValueChange={([v]) => handleChange("smoothing", v)}
              />
            </div>

            {/* 筆刷顏色 */}
            <div>
              <Label>筆刷顏色（color）</Label>
              <input
                type="color"
                value={options.color ?? "#000000"}
                onChange={(e) => handleChange("color", e.target.value)}
                className="w-10 h-10 p-0 border rounded"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
