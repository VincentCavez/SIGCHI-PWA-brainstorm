import React, { useEffect, useRef, useState } from "react";
import type { Worker as OcrWorker } from "tesseract.js";
import { roomFromQr, roomFromSign } from "./lib/room-identification";

export type CaptureMode = "sign" | "qr";
type Props = {
  mode: CaptureMode;
  onRoom: (room: string) => void;
  onClose: () => void;
};

function drawFrame(
  source: HTMLVideoElement | HTMLImageElement,
  canvas: HTMLCanvasElement,
) {
  const width =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source.naturalWidth;
  const height =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source.naturalHeight;
  if (!width || !height) return false;
  const scale = Math.min(1, 1440 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return true;
}

export function RoomCapture({ mode, onRoom, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [camera, setCamera] = useState(true);
  const [message, setMessage] = useState("Starting camera…"),
    [hasVideo, setHasVideo] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const qr = mode === "qr";
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setCamera(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    let active = true,
      stream: MediaStream | undefined,
      worker: OcrWorker | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    let photoUrl = "",
      lastRead: string | null = null;
    const preview = video.current;
    const canvas = document.createElement("canvas");
    const stopStream = () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (preview && stream && preview.srcObject === stream)
        preview.srcObject = null;
    };
    const status = (s: string) => {
      if (active) setMessage(s);
    };
    const miss = qr
      ? "No CHI ’26 room code found. Try a closer view."
      : "No clear room label found. Frame one room name or number.";
    setHasVideo(false);
    async function scan() {
      let source: HTMLVideoElement | HTMLImageElement;
      if (file) {
        status("Reading image…");
        photoUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = photoUrl;
        await img.decode();
        source = img;
      } else {
        if (!camera) {
          status("Camera paused. Use a photo or restart the camera.");
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          status("Camera access is unavailable here. Choose an image instead.");
          return;
        }
        status("Starting camera…");
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch (e) {
          const denied =
            e instanceof DOMException && e.name === "NotAllowedError";
          status(
            denied
              ? "Camera permission was declined. Choose an image or allow camera access and retry."
              : "Couldn’t start the camera. Choose an image or retry.",
          );
          return;
        }
        if (!active || !preview) {
          stopStream();
          return;
        }
        preview.srcObject = stream;
        await preview.play();
        if (!active) return;
        setHasVideo(true);
        source = preview;
      }
      if (!active) return;
      let read: () => Promise<string | null>;
      if (qr) {
        const jsQR = (await import("jsqr")).default;
        read = async () => {
          const ctx = canvas.getContext("2d")!;
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (!code) return null;
          const found = roomFromQr(code.data);
          if (!found && !file)
            status(
              "Unrecognized code. Point the camera at a CHI ’26 demo room QR.",
            );
          return found;
        };
      } else {
        status("Loading the room-sign reader…");
        const { createWorker, OEM, PSM } = await import("tesseract.js");
        if (!active) return;
        const base = new URL("./room-tools/", document.baseURI);
        const created = await createWorker("eng", OEM.LSTM_ONLY, {
          workerPath: new URL("worker.min.js", base).href,
          corePath: new URL("tesseract-core-lstm.wasm.js", base).href,
          langPath: base.href,
          workerBlobURL: false,
          errorHandler: () =>
            status(
              "The sign reader could not read this image. Try another photo or enter the room.",
            ),
        });
        if (!active) {
          await created.terminate();
          return;
        }
        worker = created;
        await created.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        read = async () => {
          const { data } = await created.recognize(canvas);
          return roomFromSign(data.text, data.confidence);
        };
      }
      if (!active) return;
      status(qr ? "Looking for a room QR code…" : "Looking for a room sign…");
      const frame = async () => {
        if (!active) return;
        try {
          if (drawFrame(source, canvas)) {
            const found = await read();
            if (!active) return;
            if (found && (file || qr || found === lastRead)) {
              stopStream();
              onRoom(found);
              return;
            }
            lastRead = found;
            if (file) {
              status(miss);
              return;
            }
          }
          timer = setTimeout(frame, qr ? 250 : 650);
        } catch {
          if (active) {
            stopStream();
            setHasVideo(false);
            status(
              "Couldn’t read the image. Choose another image or select the room manually.",
            );
          }
        }
      };
      await frame();
    }
    scan().catch(() => {
      if (active) {
        stopStream();
        setHasVideo(false);
        status(
          "Couldn’t start the reader. Try another image or choose the room manually.",
        );
      }
    });
    return () => {
      active = false;
      clearTimeout(timer);
      stopStream();
      if (worker) void worker.terminate().catch(() => {});
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [file, camera, qr, onRoom, attempt]);

  return (
    <section
      className="roomCapture"
      aria-label={qr ? "Room QR scanner" : "Automatic room detection"}
    >
      <div className="captureTop">
        <h3 ref={heading} tabIndex={-1}>
          {qr ? "Scan a room QR" : "Read a room sign"}
        </h3>
        <button type="button" className="textBtn" onClick={onClose}>
          Close
        </button>
      </div>
      <p>
        {qr
          ? "Point the camera at one of the demo room codes."
          : "Point the camera at a single room sign, such as “Room 115”."}{" "}
        Images stay on this device.
      </p>
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        hidden={!hasVideo}
        aria-label="Room camera preview"
      />
      <p className="captureStatus" role="status">
        {message}
      </p>
      <div className="captureActions">
        <label>
          Choose an image
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (next) {
                setFile(next);
                e.target.value = "";
              }
            }}
          />
        </label>
        {(!hasVideo || file) && (
          <button
            type="button"
            className="textBtn"
            onClick={() => {
              setFile(null);
              setCamera(true);
              setAttempt((a) => a + 1);
            }}
          >
            Use camera
          </button>
        )}
        {qr && (
          <a href="./room-codes/index.html" target="_blank" rel="noreferrer">
            View room QR codes
          </a>
        )}
      </div>
    </section>
  );
}
