// Copie dans public/room-tools les fichiers du lecteur de panneaux (OCR Tesseract),
// chargés à l'exécution par src/networking/room-capture.tsx. Repris de la démo
// anranxu/sigchi-networking-demo (scripts/build-room-tools.mjs).
import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";

const out = path.join("public", "room-tools");
await mkdir(out, { recursive: true });
const assets = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js/dist/worker.min.js.LICENSE.txt", "worker.min.js.LICENSE.txt"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/LICENSE", "LICENSE-ocr.txt"],
  ["tesseract.js/LICENSE.md", "LICENSE-tesseract.txt"],
  ["jsqr/LICENSE", "LICENSE-jsqr.txt"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
];
await Promise.all(assets.map(([from, to]) => copyFile(path.join("node_modules", from), path.join(out, to))));
console.log(`room-tools: ${assets.length} fichiers copiés dans ${out}`);
