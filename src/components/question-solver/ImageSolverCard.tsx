"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Sparkles } from "lucide-react";

type SolveMode = "answer_only" | "explanation" | "step_by_step";

type SolvedQuestion = {
  finalAnswer: string;
  explanation: string;
  steps: { title: string; content: string }[];
  confidence: number;
  needsReview: boolean;
  warnings: string[];
  learningPoints: string[];
};

/** 画像内の正規化座標（0-1、左上原点）で保持する切り抜き範囲 */
type NormalizedRect = { x: number; y: number; width: number; height: number };

const MAX_DATA_URL_LENGTH = 2_400_000;

const MODE_LABELS: { value: SolveMode; label: string }[] = [
  { value: "answer_only", label: "解答のみ" },
  { value: "explanation", label: "解説" },
  { value: "step_by_step", label: "途中式" },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を表示できませんでした。"));
    image.src = dataUrl;
  });
}

function isImageFile(file: File | null | undefined): file is File {
  return Boolean(file && /^image\/(png|jpe?g|webp)$/i.test(file.type));
}

function imageFileFromTransfer(
  transfer: DataTransfer | null,
): File | undefined {
  const fromFiles = Array.from(transfer?.files ?? []).find(isImageFile);
  if (fromFiles) {
    return fromFiles;
  }
  return Array.from(transfer?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .find(isImageFile);
}

/** 切り抜き→JPEG圧縮。cropはnullなら全体 */
async function toJpegDataUrl(
  sourceDataUrl: string,
  crop: NormalizedRect | null,
): Promise<string> {
  const image = await loadImage(sourceDataUrl);
  const sx = crop ? Math.round(crop.x * image.naturalWidth) : 0;
  const sy = crop ? Math.round(crop.y * image.naturalHeight) : 0;
  const sw = crop
    ? Math.max(8, Math.round(crop.width * image.naturalWidth))
    : image.naturalWidth;
  const sh = crop
    ? Math.max(8, Math.round(crop.height * image.naturalHeight))
    : image.naturalHeight;

  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    return sourceDataUrl;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.92, 0.84, 0.74, 0.64]) {
    const encoded = canvas.toDataURL("image/jpeg", quality);
    if (encoded.length <= MAX_DATA_URL_LENGTH) {
      return encoded;
    }
  }
  return canvas.toDataURL("image/jpeg", 0.55);
}

export function ImageSolverCard() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<NormalizedRect | null>(null);
  const [draftRect, setDraftRect] = useState<NormalizedRect | null>(null);
  const [mode, setMode] = useState<SolveMode>("explanation");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SolvedQuestion | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const acceptFile = useCallback(async (file: File | undefined) => {
    if (!isImageFile(file)) {
      setError("PNG / JPEG / WebP の画像を貼り付けてください。");
      return;
    }
    setError(null);
    setResult(null);
    setCropRect(null);
    setImageDataUrl(await readFileAsDataUrl(file));
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = imageFileFromTransfer(event.clipboardData);
      if (file) {
        event.preventDefault();
        void acceptFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptFile]);

  function normalizedPoint(event: React.MouseEvent): { x: number; y: number } {
    const box = imageBoxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    };
  }

  function rectFromPoints(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): NormalizedRect {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
      x,
      y,
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y),
    };
  }

  function onMouseDown(event: React.MouseEvent) {
    if (!imageDataUrl) {
      return;
    }
    event.preventDefault();
    dragStartRef.current = normalizedPoint(event);
    setDraftRect(null);
  }

  function onMouseMove(event: React.MouseEvent) {
    if (!dragStartRef.current) {
      return;
    }
    setDraftRect(rectFromPoints(dragStartRef.current, normalizedPoint(event)));
  }

  function onMouseUp(event: React.MouseEvent) {
    if (!dragStartRef.current) {
      return;
    }
    const rect = rectFromPoints(dragStartRef.current, normalizedPoint(event));
    dragStartRef.current = null;
    setDraftRect(null);
    if (rect.width > 0.02 && rect.height > 0.02) {
      setCropRect(rect);
    }
  }

  async function solve() {
    if (!imageDataUrl || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const attached = await toJpegDataUrl(imageDataUrl, cropRect);
      if (attached.length > MAX_DATA_URL_LENGTH) {
        throw new Error(
          "画像が大きすぎます。問題部分だけを切り抜いてください。",
        );
      }
      const stem =
        "添付した画像に写っている問題を読み取り、解答してください。";
      const response = await fetch("/api/solve-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-operation-id": crypto.randomUUID(),
          "x-request-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          question: {
            questionId: `web-image-${Date.now()}`,
            source: "generic_dom",
            subject: "unknown",
            gradeLevel: "unknown",
            answerType: "unknown",
            stem,
            rawText: stem,
            pageUrl: "",
            pageTitle: "画像アップロード",
            confidence: 0.7,
            visualImageDataUrl: attached,
          },
          mode,
          language: "ja",
        }),
      });
      if (response.status === 401) {
        throw new Error(
          "ログインが必要です。ログイン後にもう一度お試しください。",
        );
      }
      const data = (await response.json()) as SolvedQuestion & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "解答の生成に失敗しました。");
      }
      setResult(data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "解答の生成に失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  const shownRect = draftRect ?? cropRect;

  return (
    <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
          <ImagePlus className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            IMAGE SOLVER
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            スクショ・画像から解く
          </h2>
        </div>
      </div>

      <p className="mb-4 text-sm font-medium leading-6 text-[#3f3f46]">
        問題のスクリーンショットを貼り付け（Cmd+V）またはドロップし、必要ならドラッグで問題部分を切り抜いて「解く」を押してください。解答にはトークンを消費します。
      </p>

      {imageDataUrl ? (
        <div className="grid gap-3">
          <div
            ref={imageBoxRef}
            className="relative w-fit max-w-full cursor-crosshair select-none overflow-hidden rounded-2xl ring-1 ring-black/[0.08]"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt="解答対象の画像"
              className="block max-h-[420px] w-auto max-w-full"
              draggable={false}
            />
            {shownRect ? (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-amber-400"
                style={{
                  left: `${shownRect.x * 100}%`,
                  top: `${shownRect.y * 100}%`,
                  width: `${shownRect.width * 100}%`,
                  height: `${shownRect.height * 100}%`,
                  boxShadow: "0 0 0 100000px rgba(15, 23, 42, 0.35)",
                }}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-[#f5f5f7] p-1">
              {MODE_LABELS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    mode === option.value
                      ? "bg-[#1d1d1f] text-white"
                      : "text-[#6e6e73]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void solve()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {loading ? "解答を生成中..." : "解く"}
            </button>
            {cropRect ? (
              <button
                type="button"
                onClick={() => setCropRect(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-4 py-2 text-xs font-semibold text-[#3f3f46]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                切り抜きをリセット
              </button>
            ) : (
              <span className="text-xs font-medium text-[#6e6e73]">
                画像上をドラッグすると問題部分だけを送信できます
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setImageDataUrl(null);
                setCropRect(null);
                setResult(null);
                setError(null);
              }}
              className="rounded-full bg-[#f5f5f7] px-4 py-2 text-xs font-semibold text-[#3f3f46]"
            >
              画像を変更
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void acceptFile(imageFileFromTransfer(event.dataTransfer));
          }}
          className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-black/15 bg-[#f5f5f7] px-6 py-10 text-sm font-semibold text-[#6e6e73] transition hover:border-[var(--accent)]"
        >
          <ImagePlus className="h-6 w-6" aria-hidden />
          クリックして画像を選択、またはここにドロップ / Cmd+V で貼り付け
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          void acceptFile(
            Array.from(event.target.files ?? []).find(isImageFile),
          );
          event.target.value = "";
        }}
      />

      {error ? (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <article className="mt-4 grid gap-3 rounded-3xl bg-[#f5f5f7] p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#6e6e73]">
            <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-black/[0.06]">
              confidence {Math.round((result.confidence || 0) * 100)}%
            </span>
            {result.needsReview ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                要確認
              </span>
            ) : null}
          </div>
          <h3 className="text-xl font-semibold text-[#1d1d1f]">
            {result.finalAnswer}
          </h3>
          {mode !== "answer_only" && result.explanation ? (
            <p className="text-sm font-medium leading-7 text-[#3f3f46]">
              {result.explanation}
            </p>
          ) : null}
          {mode === "step_by_step"
            ? (result.steps ?? []).map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl bg-white p-3 text-sm leading-6"
                >
                  <p className="font-semibold text-[#1d1d1f]">{step.title}</p>
                  <p className="mt-1 font-medium text-[#3f3f46]">
                    {step.content}
                  </p>
                </div>
              ))
            : null}
          {result.warnings?.length ? (
            <p className="text-xs font-medium text-amber-700">
              {result.warnings.join(" / ")}
            </p>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
