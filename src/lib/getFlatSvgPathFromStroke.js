import polygonClipping from "polygon-clipping";
import getSvgPathFromStroke from "./getSvgPathFromStroke";

export default function getFlatSvgPathFromStroke(stroke) {
  const faces = polygonClipping.union([stroke]);
  const d = [];

  faces.forEach((face) =>
    face.forEach((points) => {
      d.push(getSvgPathFromStroke(points));
    })
  );

  return d.join(" ");
}
