const questionsEl = document.getElementById("questions");
const solutionEl = document.getElementById("solution");
const detectNowButton = document.getElementById("detectNow");
const restartDetectionButton = document.getElementById("restartDetection");
const solveModeButtons = Array.from(
  document.querySelectorAll("[data-solve-mode]"),
);

let autoSolvedSignature = "";
let solvingSignature = "";
let currentSolveMode = "explanation";
let activeSolutionMode = "explanation";
const manualImages = new Map();
const MAX_MANUAL_IMAGE_DATA_URL_LENGTH = 2_400_000;

const validSolveModes = new Set(["answer_only", "explanation", "step_by_step"]);

function setSolveMode(mode, options = {}) {
  if (!validSolveModes.has(mode)) {
    return;
  }
  currentSolveMode = mode;
  solveModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.solveMode === mode);
  });
  if (options.persist !== false) {
    chrome.storage.sync.set({ yfyQuestionSolveMode: mode });
  }
}

function selectedSolveMode() {
  return currentSolveMode;
}

function confidence(question) {
  return `${Math.round((question.confidence || 0) * 100)}%`;
}

function questionSignature(question) {
  const imageMarker = question.visualImageDataUrl
    ? [
        question.visualImageDataUrl.length,
        question.visualImageDataUrl.slice(0, 80),
        question.visualImageDataUrl.slice(-80),
      ].join(":")
    : "";
  return [
    question.pageUrl,
    question.questionId,
    String(question.rawText || question.stem || "").slice(0, 800),
    String(question.visualContext || "").slice(0, 800),
    imageMarker,
  ].join("::");
}

function needsManualVisualContext(question) {
  const text = [
    question.stem,
    question.rawText,
    question.passage,
    ...(question.choices || []).map((choice) => choice.text),
  ]
    .filter(Boolean)
    .join("\n");
  return (
    (question.confidence || 0) < 0.55 ||
    /図\/表画像|画像として表示|DOMテキストから中身を取得できません|表|グラフ|図/.test(
      text,
    )
  );
}

function manualContextFor(index) {
  return document
    .querySelector(`[data-context-index="${index}"]`)
    ?.value?.trim();
}

function manualImageFor(index) {
  return manualImages.get(index);
}

function withManualContext(question, context, imageDataUrl) {
  if (!context && !imageDataUrl) {
    return question;
  }
  return {
    ...question,
    visualContext: context || question.visualContext,
    visualImageDataUrl: imageDataUrl || question.visualImageDataUrl,
    rawText: [
      question.rawText,
      context ? `表・グラフ補足:\n${context}` : "",
      imageDataUrl ? "手動添付画像: あり" : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 42000),
    confidence: Math.max(question.confidence || 0, 0.72),
  };
}

function setImageStatus(index, message, state = "") {
  const status = document.querySelector(`[data-image-status="${index}"]`);
  if (!status) {
    return;
  }
  status.textContent = message;
  status.dataset.state = state;
}

function setImagePreview(index, dataUrl) {
  const preview = document.querySelector(`[data-image-preview="${index}"]`);
  if (!preview) {
    return;
  }
  preview.src = dataUrl;
  preview.hidden = false;
}

function isImageFile(file) {
  return file && /^image\/(png|jpe?g|webp)$/i.test(file.type);
}

function imageFileFromTransfer(dataTransfer) {
  const fileFromFiles = Array.from(dataTransfer?.files || []).find(isImageFile);
  if (fileFromFiles) {
    return fileFromFiles;
  }

  return Array.from(dataTransfer?.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .find(isImageFile);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を表示できませんでした。"));
    image.src = dataUrl;
  });
}

async function compressImageDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    return dataUrl;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.9, 0.84, 0.76, 0.68]) {
    const compressed = canvas.toDataURL("image/jpeg", quality);
    if (compressed.length <= MAX_MANUAL_IMAGE_DATA_URL_LENGTH) {
      return compressed;
    }
  }

  return canvas.toDataURL("image/jpeg", 0.58);
}

function solveWithManualImage(index) {
  const button = questionsEl.querySelector(
    `button[data-index="${index}"][data-with-context="true"]`,
  );
  if (button instanceof HTMLButtonElement) {
    button.click();
  }
}

async function handleManualImage(index, file) {
  if (!isImageFile(file)) {
    setImageStatus(index, "PNG / JPEG / WebP の画像を貼ってください。", "error");
    return;
  }
  setImageStatus(index, "画像を読み込んでいます...", "loading");
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const compressed = await compressImageDataUrl(dataUrl);
    if (compressed.length > MAX_MANUAL_IMAGE_DATA_URL_LENGTH) {
      manualImages.delete(index);
      setImageStatus(
        index,
        "画像が大きすぎます。表・グラフ部分だけに切り取ってください。",
        "error",
      );
      return;
    }
    manualImages.set(index, compressed);
    setImagePreview(index, compressed);
    setImageStatus(index, "画像を追加しました。画像付きで解いています。", "ok");
    solveWithManualImage(index);
  } catch (error) {
    manualImages.delete(index);
    setImageStatus(index, error?.message || "画像を読み込めませんでした。", "error");
  }
}

function normalizeLatex(value) {
  return String(value ?? "")
    .replaceAll("\\\\", "\\")
    .replace(/\\displaystyle\s*/g, "")
    .trim();
}

function compactMathText(value) {
  const normalized = normalizeLatex(value);
  const fractionOnly = normalized.match(
    /^(\d+)\s*(\\frac\{([^{}]+)\}\{([^{}]+)\})$/,
  );
  if (fractionOnly && fractionOnly[1] === `${fractionOnly[3]}${fractionOnly[4]}`) {
    return fractionOnly[2];
  }
  return normalized;
}

function renderFraction(numerator, denominator) {
  return [
    '<span class="math-frac">',
    `<span class="math-frac-num">${escapeHtml(numerator)}</span>`,
    `<span class="math-frac-den">${escapeHtml(denominator)}</span>`,
    "</span>",
  ].join("");
}

function formatMath(value) {
  return escapeHtml(compactMathText(value))
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, numerator, denominator) =>
      renderFraction(numerator, denominator),
    )
    .replace(/\\times/g, '<span class="math-op">×</span>')
    .replace(/\\cdot/g, '<span class="math-op">・</span>')
    .replace(/\\div/g, '<span class="math-op">÷</span>')
    .replace(/\\leq?/g, '<span class="math-op">≤</span>')
    .replace(/\\geq?/g, '<span class="math-op">≥</span>');
}

function renderMathInline(value) {
  return `<span class="math-inline">${formatMath(value)}</span>`;
}

function renderMathDisplay(value) {
  return `<div class="math-display">${formatMath(value)}</div>`;
}

function renderRichText(value) {
  const normalized = normalizeLatex(value);
  let html = "";
  let lastIndex = 0;
  const delimitedMath = /\\\((.*?)\\\)|\\\[(.*?)\\\]/gs;
  let match = delimitedMath.exec(normalized);
  while (match) {
    html += renderBareMath(normalized.slice(lastIndex, match.index));
    html += match[2]
      ? renderMathDisplay(match[2])
      : renderMathInline(match[1] ?? "");
    lastIndex = match.index + match[0].length;
    match = delimitedMath.exec(normalized);
  }
  html += renderBareMath(normalized.slice(lastIndex));
  return html;
}

function renderBareMath(value) {
  return escapeHtml(value)
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, numerator, denominator) =>
      renderFraction(numerator, denominator),
    )
    .replace(/\\times/g, '<span class="math-op">×</span>')
    .replace(/\\cdot/g, '<span class="math-op">・</span>')
    .replace(/\\div/g, '<span class="math-op">÷</span>');
}

function renderQuestions(questions) {
  manualImages.clear();
  if (!questions.length) {
    questionsEl.innerHTML = '<div class="empty">検知された問題はありません。</div>';
    autoSolvedSignature = "";
    return;
  }
  questionsEl.innerHTML = questions
    .map(
      (question, index) => `
        <article class="question">
          <div class="meta">
            <span class="pill">${question.subject}</span>
            <span class="pill">${question.answerType}</span>
            <span class="pill">${confidence(question)}</span>
          </div>
          <p class="stem">${renderRichText(question.stem)}</p>
          ${
            question.choices?.length
              ? `<div class="choice-list">${question.choices
                  .map(
                    (choice) =>
                      `<div class="choice"><span>${escapeHtml(choice.id)}</span>${renderRichText(
                        compactMathText(choice.text),
                      )}</div>`,
                  )
                  .join("")}</div>`
              : ""
          }
          ${
            question.mathLatex?.length
              ? `<div class="math">${question.mathLatex
                  .map((item) => renderMathDisplay(item))
                  .join("")}</div>`
              : ""
          }
          ${
            needsManualVisualContext(question)
              ? `
                <div class="manual-context">
                  <label for="manual-context-${index}">表・グラフの数値を貼り付け</label>
                  <textarea
                    id="manual-context-${index}"
                    data-context-index="${index}"
                    rows="4"
                    placeholder="例: 男 国語85.0 算数90.0 英語76.0 / 女 国語84.0 算数85.0 英語82.0"
                  ></textarea>
                  <div
                    class="manual-image-zone"
                    data-image-zone="${index}"
                    tabindex="0"
                    role="button"
                    aria-label="画像を貼り付けまたは選択"
                  >
                    <input
                      id="manual-image-${index}"
                      data-image-input="${index}"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                    />
                    <span>画像を貼り付け / クリックして選択</span>
                    <small data-image-status="${index}">
                      表・グラフが画像の場合だけ使用します。
                    </small>
                    <img data-image-preview="${index}" alt="" hidden />
                  </div>
                </div>
              `
              : ""
          }
          <div class="actions">
            <button data-index="${index}" data-mode="selected">解く</button>
            ${
              needsManualVisualContext(question)
                ? `<button data-index="${index}" data-mode="selected" data-with-context="true">補足して解く</button>`
                : ""
            }
            <button class="secondary" data-index="${index}" data-mode="hint">ヒント</button>
          </div>
        </article>
      `,
    )
    .join("");
  questionsEl.querySelectorAll("button[data-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const question = questions[index];
      const context = manualContextFor(index);
      const imageDataUrl = manualImageFor(index);
      if (button.dataset.withContext === "true" && !context && !imageDataUrl) {
        renderSolution({
          error:
            "表・グラフの数値を貼るか、画像を貼り付け/選択してから実行してください。",
        });
        return;
      }
      const nextQuestion =
        context || imageDataUrl || button.dataset.withContext === "true"
          ? withManualContext(question, context, imageDataUrl)
          : question;
      const mode =
        button.dataset.mode === "hint" ? "hint" : selectedSolveMode();
      solve(nextQuestion, mode, { force: true });
    });
  });
  bindManualImageControls();
  autoSolveFirstQuestion(questions);
}

function bindManualImageControls() {
  questionsEl.querySelectorAll("[data-image-zone]").forEach((zone) => {
    const index = Number(zone.dataset.imageZone);
    const input = document.querySelector(`[data-image-input="${index}"]`);

    zone.addEventListener("click", () => input?.click());
    zone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input?.click();
      }
    });
    zone.addEventListener("paste", (event) => {
      const file = imageFileFromTransfer(event.clipboardData);
      if (!file) {
        setImageStatus(index, "クリップボードに画像がありません。", "error");
        return;
      }
      event.preventDefault();
      handleManualImage(index, file);
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("dragging");
    });
    zone.addEventListener("dragleave", () => {
      zone.classList.remove("dragging");
    });
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("dragging");
      const file = imageFileFromTransfer(event.dataTransfer);
      if (!file) {
        setImageStatus(index, "画像ファイルをドロップしてください。", "error");
        return;
      }
      handleManualImage(index, file);
    });
    input?.addEventListener("change", () => {
      const file = Array.from(input.files || []).find(isImageFile);
      if (file) {
        handleManualImage(index, file);
      }
      input.value = "";
    });
  });
}

function renderSolution(solution, renderMode = activeSolutionMode) {
  if (!solution) {
    solutionEl.innerHTML = "";
    return;
  }
  if (solution.error) {
    solutionEl.innerHTML = `<div class="solution-card error">${escapeHtml(solution.error)}</div>`;
    return;
  }
  const showExplanation =
    renderMode !== "answer_only" || solution.needsReview || !solution.finalAnswer;
  const showSteps = renderMode === "step_by_step";
  solutionEl.innerHTML = `
    <article class="solution-card">
      <div class="meta">
        <span class="pill">confidence ${Math.round((solution.confidence || 0) * 100)}%</span>
        ${solution.needsReview ? '<span class="pill">要確認</span>' : ""}
      </div>
      <h2>${renderRichText(solution.finalAnswer || "")}</h2>
      ${showExplanation ? `<p>${renderRichText(solution.explanation || "")}</p>` : ""}
      ${
        showSteps
          ? (solution.steps || [])
              .map(
                (step) => `
                  <div class="step">
                    <p><strong>${escapeHtml(step.title)}</strong></p>
                    <p>${renderRichText(step.content)}</p>
                  </div>
                `,
              )
              .join("")
          : ""
      }
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function autoSolveFirstQuestion(questions) {
  const question = questions[0];
  if (!question) {
    return;
  }
  if ((question.confidence || 0) < 0.55) {
    renderSolution({
      finalAnswer: "",
      explanation:
        "問題本文の検知が不十分です。表・グラフが画像化されている場合は、左の補足欄に数値を貼り付けるか、画像を貼り付けて「補足して解く」を押してください。",
      confidence: question.confidence || 0,
      needsReview: true,
    });
    return;
  }
  const signature = questionSignature(question);
  if (signature === autoSolvedSignature || signature === solvingSignature) {
    return;
  }
  autoSolvedSignature = signature;
  solve(question, selectedSolveMode());
}

function solve(question, mode, options = {}) {
  const signature = questionSignature(question);
  if (!options.force && signature === solvingSignature) {
    return;
  }
  activeSolutionMode = mode;
  solvingSignature = signature;
  renderSolution(
    { finalAnswer: "生成中...", explanation: "", confidence: 0 },
    mode,
  );
  chrome.runtime.sendMessage(
    { type: "SOLVE_QUESTION", question, mode },
    (response) => {
      solvingSignature = "";
      if (!response?.ok) {
        renderSolution(response?.data || { error: "解答生成に失敗しました。" });
        return;
      }
      renderSolution(response.data, mode);
    },
  );
}

function refresh() {
  chrome.runtime.sendMessage({ type: "GET_QUESTIONS" }, (response) => {
    renderQuestions(response?.questions || []);
  });
}

function runDetection(type) {
  chrome.runtime.sendMessage({ type }, (response) => {
    if (!response?.ok) {
      renderSolution({
        error: response?.error || "検知を実行できませんでした。",
      });
      return;
    }
    refresh();
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "QUESTIONS_UPDATED") {
    renderQuestions(message.questions || []);
  }
});

detectNowButton.addEventListener("click", () => runDetection("RUN_DETECTION"));
restartDetectionButton.addEventListener("click", () =>
  runDetection("RESTART_DETECTION"),
);

document.addEventListener("paste", (event) => {
  const file = imageFileFromTransfer(event.clipboardData);
  if (!file) {
    return;
  }
  const activeZone = document.activeElement?.closest?.("[data-image-zone]");
  const zone = activeZone || questionsEl.querySelector("[data-image-zone]");
  if (!zone) {
    return;
  }
  event.preventDefault();
  handleManualImage(Number(zone.dataset.imageZone), file);
});

solveModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSolveMode(button.dataset.solveMode || "explanation");
  });
});

chrome.storage.sync.get(
  { yfyQuestionSolveMode: "explanation" },
  ({ yfyQuestionSolveMode }) => {
    setSolveMode(yfyQuestionSolveMode, { persist: false });
    refresh();
  },
);

setSolveMode("explanation", { persist: false });
