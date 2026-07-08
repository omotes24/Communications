(() => {
if (globalThis.__YFY_QUESTION_DETECTOR_ACTIVE__) {
  try {
    globalThis.__YFY_QUESTION_DETECTOR_PUBLISH__?.({ force: true });
  } catch {
    // Existing detector is from an invalidated extension context.
  }
  return;
}

globalThis.__YFY_QUESTION_DETECTOR_ACTIVE__ = true;

const QUESTION_WORDS = [
  "問",
  "問題",
  "次の",
  "選びなさい",
  "求めなさい",
  "解きなさい",
  "説明しなさい",
  "答えなさい",
];

const APP_HOSTS = new Set([
  "www.yell-for-you.jp",
  "communications-umber.vercel.app",
  "localhost",
  "127.0.0.1",
]);

const QUESTION_COUNTER_RE = /Question\s*\d+\s*of\s*\d+|^問\s*\d+/i;
const QUESTION_START_RE = /^\d+[.．]\s*/;
const ACTION_LINE_RE = /次の問題|前の問題|送信|採点|解答する|終了|戻る/;
const NAV_LINE_RE =
  /ホーム|お問い合わせ|ログイン|受講生の声|よくある質問|試験対策講座|社会人のやり直し|オンライン講座|SHOP/;
const PROGRESS_LINE_RE =
  /^(?:残り時間\s*[:：]?\s*)?\d{1,2}\s*[:：]\s*\d{2}$|^%$/;
const NOISE_LINE_RE =
  /回答時間|解答状況|試験制限時間|undefined|Bluenotes|メーカー希望小売価格$/;
const CHOICE_PREFIX_RE =
  /^(?:[A-ZＡ-Ｚ]|[アイウエオカキクケコサシスセソ]|[ア-ン]|[0-9]{1,2})[.．、):：\s]+/;
const COMPOSITE_CHOICE_RE =
  /[アイウエオカキクケコサシスセソ][：:]\s*\S+.*[アイウエオカキクケコサシスセソ][：:]\s*\S+/;
const SHORT_NUMERIC_CHOICE_RE =
  /^(?:[-+]?\d+(?:\.\d+)?\s*%?|[-+]?\d+\s*\/\s*[-+]?\d+|\\frac\{[^{}]+\}\{[^{}]+\}|いずれでもない|どちらでもない|なし|該当なし)$/;
const STRONG_START_RE =
  /次の文章|次の文|下線部|この問題|以下の|表\d*|図\d*|文章を読んで|問いに答え|選びなさい|求めなさい|何[％%]?|いくつ|どれ|このとき|場合|割合|確率|売上|利益|料金|金額|人数|個数|個|円/;

function isAppPage() {
  return APP_HOSTS.has(location.hostname);
}

function visibleText(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return "";
  }
  return element.innerText?.replace(/\s+/g, " ").trim() ?? "";
}

function allElementsDeep(root = document) {
  const elements = [];
  const visit = (node) => {
    if (!node?.querySelectorAll) {
      return;
    }
    const children = Array.from(node.querySelectorAll("*"));
    for (const element of children) {
      elements.push(element);
      if (element.shadowRoot) {
        visit(element.shadowRoot);
      }
      if (element.matches?.("iframe")) {
        try {
          if (element.contentDocument) {
            visit(element.contentDocument);
          }
        } catch {
          // Cross-origin frames are handled by all_frames content scripts.
        }
      }
    }
  };
  visit(root);
  return elements;
}

function directVisibleText(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  if (!isElementInViewport(element)) {
    return "";
  }
  if (
    element.closest(
      "header, nav, footer, script, style, noscript, #yfy-question-detect-widget",
    )
  ) {
    return "";
  }
  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return "";
  }
  if (
    element.matches(
      "input, textarea, select, option, [contenteditable='true'], [role='textbox']",
    )
  ) {
    const type = element.getAttribute("type") || "";
    if (/button|submit|reset/i.test(type)) {
      return element.value?.trim() || "";
    }
    return "";
  }
  const directText = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (directText) {
    return directText;
  }
  if (element.matches("img")) {
    return element.getAttribute("alt")?.trim() || "";
  }
  return "";
}

function textNodeViewportRows() {
  const rows = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 600) {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }
      if (
        parent.closest(
          "header, nav, footer, script, style, noscript, #yfy-question-detect-widget",
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      if (
        parent.matches(
          "input, textarea, select, option, [contenteditable='true'], [role='textbox']",
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      const style = window.getComputedStyle(parent);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        parent.getAttribute("aria-hidden") === "true"
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter(
      (rect) =>
        rect.width > 1 &&
        rect.height > 1 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth,
    );
    range.detach();
    const rect = rects[0];
    if (!rect) {
      continue;
    }
    rows.push({
      text,
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      bottom: Math.round(rect.bottom),
      element: node.parentElement,
    });
  }
  return rows;
}

function tableViewportRows() {
  return Array.from(document.querySelectorAll("table"))
    .map((table) => {
      if (!isElementInViewport(table)) {
        return null;
      }
      if (table.closest("header, nav, footer, #yfy-question-detect-widget")) {
        return null;
      }
      const rows = Array.from(table.querySelectorAll("tr"))
        .map((row) =>
          Array.from(row.querySelectorAll("th, td"))
            .map((cell) => (cell.innerText || cell.textContent || "").trim())
            .filter(Boolean)
            .join(" | "),
        )
        .filter(Boolean);
      if (!rows.length) {
        return null;
      }
      const caption = table.querySelector("caption")?.innerText?.trim();
      const rect = table.getBoundingClientRect();
      return {
        text: [caption ? `表: ${caption}` : "表:", ...rows]
          .join(" / ")
          .replace(/\s+/g, " ")
          .slice(0, 1800),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        bottom: Math.round(rect.bottom),
        element: table,
      };
    })
    .filter(Boolean);
}

function visualReferenceRows() {
  return Array.from(document.querySelectorAll("img, canvas, svg"))
    .map((element) => {
      if (!isElementInViewport(element)) {
        return null;
      }
      if (element.closest("header, nav, footer, #yfy-question-detect-widget")) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width < 48 || rect.height < 36) {
        return null;
      }
      if (element.matches("svg")) {
        const svgText = (element.textContent || "").replace(/\s+/g, " ").trim();
        if (svgText.length >= 3) {
          return {
            text: `図/SVG: ${svgText.slice(0, 1200)}`,
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            bottom: Math.round(rect.bottom),
            element,
          };
        }
      }
      const alt =
        element.getAttribute("alt") ||
        element.getAttribute("title") ||
        element.getAttribute("aria-label") ||
        "";
      const normalizedAlt = alt.replace(/\s+/g, " ").trim();
      const text = normalizedAlt
        ? `図/表画像: ${normalizedAlt}`
        : "図/表画像: 画像として表示されているため、DOMテキストから中身を取得できません。";
      return {
        text,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        bottom: Math.round(rect.bottom),
        element,
      };
    })
    .filter(Boolean);
}

function isElementInViewport(element) {
  if (!element?.getBoundingClientRect) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 1 &&
    rect.height > 1 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth
  );
}

function visibleViewportLines() {
  const elementRows = allElementsDeep(document)
    .map((element) => {
      const text = directVisibleText(element);
      if (!text || text.length > 600) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      return {
        text,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        bottom: Math.round(rect.bottom),
        element,
      };
    })
    .filter(Boolean);
  const rows = [
    ...elementRows,
    ...textNodeViewportRows(),
    ...tableViewportRows(),
    ...visualReferenceRows(),
  ]
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const lines = [];
  const seen = new Set();
  for (const row of rows) {
    const previous = lines[lines.length - 1];
    const normalized = row.text.replace(/\s+/g, " ").trim();
    const positionKey = `${Math.round(row.top / 4)}:${Math.round(
      row.left / 4,
    )}:${normalized}`;
    if (previous?.text === normalized || seen.has(positionKey)) {
      continue;
    }
    if (
      NAV_LINE_RE.test(normalized) ||
      NOISE_LINE_RE.test(normalized) ||
      normalized === "次へ"
    ) {
      continue;
    }
    seen.add(positionKey);
    lines.push({ ...row, text: normalized });
  }
  return lines;
}

function isMeaningfulProblemLine(line) {
  const text = line.text || "";
  return (
    text.length > 1 &&
    !NAV_LINE_RE.test(text) &&
    !NOISE_LINE_RE.test(text) &&
    !PROGRESS_LINE_RE.test(text) &&
    text !== "次へ"
  );
}

function isActionLikeLine(text) {
  return ACTION_LINE_RE.test(text) || text === "次へ";
}

function isChoiceLikeLine(text) {
  const normalized = String(text || "").trim();
  if (!normalized || normalized.length > 120) {
    return false;
  }
  if (SHORT_NUMERIC_CHOICE_RE.test(normalized)) {
    return true;
  }
  if (CHOICE_PREFIX_RE.test(normalized)) {
    return true;
  }
  return /^○\s*\S+|^●\s*\S+/.test(normalized);
}

function isQuestionLikeLine(text) {
  const normalized = String(text || "").trim();
  return (
    QUESTION_COUNTER_RE.test(normalized) ||
    QUESTION_START_RE.test(normalized) ||
    STRONG_START_RE.test(normalized) ||
    QUESTION_WORDS.some((word) => normalized.includes(word)) ||
    /[かか？?][。．！？!?]?$/.test(normalized)
  );
}

function hasProblemSubstance(lines) {
  return lines.some((line) => {
    const text = line.text || "";
    return (
      text.length >= 14 &&
      !isChoiceLikeLine(text) &&
      !QUESTION_COUNTER_RE.test(text) &&
      !/^[A-Z]?$/.test(text)
    );
  });
}

function compactProblemLines(lines) {
  const selected = [];
  const seen = new Set();
  for (const line of lines) {
    const text = (line.text || "").replace(/\s+/g, " ").trim();
    if (!text || seen.has(text) || !isMeaningfulProblemLine(line)) {
      continue;
    }
    seen.add(text);
    selected.push({ ...line, text });
  }
  return selected;
}

function selectAdaptiveProblemLines(lines, inputs) {
  const problemLines = compactProblemLines(lines);
  if (!problemLines.length) {
    return [];
  }

  const firstChoiceIndex = problemLines.findIndex((line) =>
    isChoiceLikeLine(line.text),
  );
  const strongStartIndex = problemLines.findIndex((line) =>
    isQuestionLikeLine(line.text),
  );

  let startIndex = strongStartIndex >= 0 ? strongStartIndex : 0;
  if (firstChoiceIndex >= 0 && firstChoiceIndex <= startIndex + 2) {
    startIndex = Math.max(0, firstChoiceIndex - 12);
  }
  if (inputs.length && firstChoiceIndex >= 0) {
    startIndex = Math.max(0, Math.min(startIndex, firstChoiceIndex - 10));
  }

  const selected = [];
  for (
    let index = startIndex;
    index < problemLines.length && selected.length < 44;
    index += 1
  ) {
    const line = problemLines[index];
    if (selected.length > 0 && isActionLikeLine(line.text)) {
      break;
    }
    if (
      selected.length > 3 &&
      QUESTION_COUNTER_RE.test(line.text) &&
      hasProblemSubstance(selected)
    ) {
      break;
    }
    selected.push(line);
  }

  if (
    selected.length &&
    !hasProblemSubstance(selected) &&
    firstChoiceIndex > 0
  ) {
    const fallbackStart = Math.max(0, firstChoiceIndex - 16);
    return problemLines
      .slice(fallbackStart, Math.min(problemLines.length, firstChoiceIndex + 14))
      .filter((line) => !isActionLikeLine(line.text));
  }

  return selected;
}

function extractChoicesFromLines(lines) {
  const choices = [];
  let inferredIndex = 1;
  let seenChoice = false;
  for (const line of lines) {
    const text = line.text.trim();
    if (!isChoiceLikeLine(text)) {
      if (seenChoice && text.length > 80) {
        break;
      }
      continue;
    }
    let id = String(inferredIndex);
    let choiceText = text;
    const prefixed = text.match(CHOICE_PREFIX_RE);
    if (prefixed && !COMPOSITE_CHOICE_RE.test(text)) {
      id = prefixed[0].replace(/[.．、):：\s]/g, "");
      choiceText = text.slice(prefixed[0].length).trim();
    }
    if (!choiceText || choiceText.length > 140) {
      continue;
    }
    if (choices.some((choice) => choice.text === choiceText)) {
      continue;
    }
    choices.push({ id, text: choiceText });
    inferredIndex += 1;
    seenChoice = true;
    if (choices.length >= 14) {
      break;
    }
  }
  return choices;
}

function cssSelector(element) {
  if (!element || !element.tagName) {
    return "";
  }
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }
  const path = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && path.length < 5) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) {
      path.unshift(tag);
      break;
    }
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === current.tagName,
    );
    const index = siblings.indexOf(current) + 1;
    path.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
    current = parent;
  }
  return path.join(" > ");
}

function extractMath(root) {
  const math = [];
  root
    .querySelectorAll(
      [
        "math",
        "mjx-container",
        ".MathJax",
        ".katex annotation[encoding='application/x-tex']",
        "annotation[encoding='application/x-tex']",
        "script[type^='math/tex']",
        "[data-tex]",
        "[data-latex]",
      ].join(","),
    )
    .forEach((node) => {
      const text =
        node.getAttribute?.("data-tex") ||
        node.getAttribute?.("data-latex") ||
        node.getAttribute?.("aria-label") ||
        node.textContent?.trim();
      if (text) {
        math.push(text);
      }
    });
  math.push(...extractMathFromText(visibleText(root)));
  return Array.from(new Set(math)).slice(0, 20);
}

function extractMathFromText(text) {
  const source = String(text || "");
  const patterns = [
    /\\(?:displaystyle\s*)?frac\{[^{}]+\}\{[^{}]+\}/g,
    /\\(?:sqrt|log|ln|sin|cos|tan|sum|lim)[^。！？\n]*/g,
    /[A-Za-z0-9πθα-ω]+(?:\s*[\^_=+\-*/×÷≤≥]\s*[A-Za-z0-9πθα-ω().+\-*/×÷≤≥]+){1,}/g,
  ];
  return Array.from(
    new Set(
      patterns
        .flatMap((pattern) => source.match(pattern) || [])
        .map((item) => item.replace(/\s+/g, " ").trim())
        .filter((item) => item && !/^[\d\s%]+$/.test(item)),
    ),
  ).slice(0, 20);
}

function normalizeSubject(value) {
  return ["japanese", "math", "english"].includes(value)
    ? value
    : "unknown";
}

function normalizeGrade(value) {
  return ["junior3", "high1", "high2"].includes(value) ? value : "unknown";
}

function normalizeAnswerType(value) {
  return [
    "single_choice",
    "multiple_choice",
    "text_input",
    "numeric_input",
    "essay",
    "calculation",
    "proof",
    "reading_comprehension",
  ].includes(value)
    ? value
    : "unknown";
}

function inferSubject(text, mathLatex) {
  if (
    mathLatex.length ||
    /\\frac|\\log|\\sqrt|[=^_√∑Σ∞≤≥]|二次方程式|関数|数列|指数|対数/.test(
      text,
    )
  ) {
    return "math";
  }
  const ascii = text.replace(/[^A-Za-z]/g, "").length;
  if (ascii > 40 && ascii / Math.max(text.length, 1) > 0.35) {
    return "english";
  }
  if (text.trim()) {
    return "japanese";
  }
  return "unknown";
}

function inferAnswerType({ text, choices, inputs, subject, mathLatex }) {
  if (inputs?.some((input) => input.matches?.("input[type='checkbox']"))) {
    return "multiple_choice";
  }
  if (
    inputs?.some((input) =>
      input.matches?.("input[type='radio'], select, option"),
    )
  ) {
    return choices.length > 1 ? "single_choice" : "unknown";
  }
  if (choices.length) {
    return /複数|すべて|全て|あてはまるもの|当てはまるもの|multiple|all/i.test(
      text,
    )
      ? "multiple_choice"
      : "single_choice";
  }
  if (/証明|示しなさい|prove|proof/i.test(text)) {
    return "proof";
  }
  const hasMath =
    subject === "math" ||
    mathLatex.length ||
    /\\frac|\\log|\\sqrt|[=^_√∑Σ∞≤≥]|二次方程式|数列|指数|対数/.test(text);
  if (hasMath) {
    return /値|数値|整数|小数|numeric/i.test(text)
      ? "numeric_input"
      : "calculation";
  }
  if (/本文|次の文章|読んで|reading/i.test(text)) {
    return "reading_comprehension";
  }
  return text.length > 120 ? "essay" : "text_input";
}

function baseQuestion(partial, root, source, confidence) {
  const rawText = partial.rawText || visibleText(root);
  const mathLatex = partial.mathLatex?.length
    ? partial.mathLatex
    : extractMath(root);
  const normalizedSubject = normalizeSubject(
    partial.subject || root.dataset.subject,
  );
  const subject =
    normalizedSubject === "unknown"
      ? inferSubject(rawText, mathLatex)
      : normalizedSubject;
  const choices = partial.choices?.filter((choice) => choice.text)?.slice(0, 12);
  const normalizedAnswerType = normalizeAnswerType(
    partial.answerType || root.dataset.answerType,
  );
  const answerType =
    normalizedAnswerType === "unknown"
      ? inferAnswerType({
          text: rawText,
          choices: choices || [],
          inputs: partial.inputs || [],
          subject,
          mathLatex,
        })
      : normalizedAnswerType;

  return {
    questionId:
      partial.questionId ||
      root.getAttribute("data-question-id") ||
      `dom-${Math.random().toString(36).slice(2)}`,
    source,
    subject,
    gradeLevel: normalizeGrade(partial.gradeLevel || root.dataset.grade),
    answerType,
    stem: partial.stem || rawText,
    passage: partial.passage || undefined,
    choices: choices?.length ? choices : undefined,
    inputSelector: partial.inputSelector || undefined,
    mathLatex: mathLatex.length ? mathLatex : undefined,
    rawText,
    pageUrl: location.href,
    pageTitle: document.title,
    confidence,
  };
}

function detectViewportQuestion() {
  const lines = visibleViewportLines();
  if (!lines.length) {
    return null;
  }

  const inputs = Array.from(
    document.querySelectorAll(
      'input[type="radio"], input[type="checkbox"], input[type="text"], input[type="number"], textarea, select',
    ),
  ).filter(isElementInViewport);
  const selectedLines = selectAdaptiveProblemLines(lines, inputs);
  const selected = selectedLines.map((line) => line.text);
  const stem = selected.join("\n").trim();
  if (stem.length < 8) {
    return null;
  }

  const mathLatex = extractMathFromText(stem);
  const subject = inferSubject(stem, mathLatex);
  const choices = extractChoicesFromLines(selectedLines);
  const containsQuestion = selected.some(isQuestionLikeLine);
  const containsSubstance = hasProblemSubstance(selectedLines);
  const choicesOnly = choices.length > 0 && !containsSubstance;
  const hasUnreadVisual = selected.some((text) =>
    text.includes("DOMテキストから中身を取得できません"),
  );
  const visualDataRequired =
    hasUnreadVisual && /表|図|グラフ|時刻表|資料|上の|下の/.test(stem);
  const confidence = visualDataRequired
    ? 0.48
    : choicesOnly
      ? 0.35
      : Math.min(
          0.9,
          0.48 +
          (containsQuestion ? 0.18 : 0) +
          (choices.length ? 0.12 : 0) +
          (inputs.length ? 0.08 : 0) +
          (mathLatex.length ? 0.05 : 0),
      );
  return baseQuestion(
    {
      questionId: `viewport-${location.href}-${stem.slice(0, 80)}`,
      stem: stem.slice(0, 2400),
      rawText: stem.slice(0, 5000),
      choices,
      subject,
      answerType: inferAnswerType({
        text: stem,
        choices,
        inputs,
        subject,
        mathLatex,
      }),
      mathLatex,
      inputs,
      inputSelector: inputs[0] ? cssSelector(inputs[0]) : undefined,
    },
    document.body,
    "generic_dom",
    confidence,
  );
}

function detectStructuredQuestions() {
  return Array.from(document.querySelectorAll("[data-ai-question]"))
    .map((root) => {
      const choices = Array.from(root.querySelectorAll("[data-ai-choice]")).map(
        (choice, index) => ({
          id:
            choice.getAttribute("data-choice-id") ||
            String.fromCharCode(65 + index),
          text: visibleText(choice),
        }),
      );
      const input = root.querySelector("[data-ai-answer-input]");
      const inputs = Array.from(
        root.querySelectorAll(
          'input[type="radio"], input[type="checkbox"], input[type="text"], input[type="number"], textarea, select',
        ),
      );
      return baseQuestion(
        {
          questionId: root.getAttribute("data-question-id") || undefined,
          subject: root.getAttribute("data-subject") || undefined,
          gradeLevel: root.getAttribute("data-grade") || undefined,
          answerType: root.getAttribute("data-answer-type") || undefined,
          stem: visibleText(root.querySelector("[data-ai-stem]")),
          passage: visibleText(root.querySelector("[data-ai-passage]")),
          choices,
          mathLatex: extractMath(root),
          inputs,
          inputSelector: input ? cssSelector(input) : undefined,
        },
        root,
        "structured_dom",
        0.96,
      );
    })
    .filter((question) => question.stem);
}

function detectJsonScriptQuestions() {
  const questions = [];
  document
    .querySelectorAll('script[type="application/json"][data-ai-question-json]')
    .forEach((script, scriptIndex) => {
      try {
        const parsed = JSON.parse(script.textContent || "{}");
        const items = Array.isArray(parsed.questions)
          ? parsed.questions
          : [parsed];
        items.forEach((item, index) => {
          const root = script.parentElement || document.body;
          questions.push(
            baseQuestion(
              {
                questionId:
                  item.questionId ||
                  item.id ||
                  `${parsed.questionId || "json"}-${index + 1}`,
                subject: item.subject || parsed.subject,
                gradeLevel: item.gradeLevel || parsed.gradeLevel,
                answerType: item.answerType || parsed.answerType || item.type,
                stem: item.stem || item.question || parsed.stem,
                passage: item.passage || parsed.passage,
                choices: item.choices,
                mathLatex: item.mathLatex || parsed.mathLatex,
              },
              root,
              "json_script",
              0.98 - scriptIndex * 0.01,
            ),
          );
        });
      } catch {
        // Ignore malformed embedded JSON.
      }
    });
  return questions.filter((question) => question.stem);
}

function detectGenericQuestions() {
  const selector = [
    "form",
    "fieldset",
    "main",
    "[role='main']",
    "article",
    "section",
    ".entry-content",
    ".post",
    ".post-content",
    ".content",
    ".question",
    ".problem",
    ".choices",
  ].join(",");
  return Array.from(document.querySelectorAll(selector))
    .map((root, index) => {
      const text = visibleText(root);
      if (text.length < 20) {
        return null;
      }
      const inputs = root.querySelectorAll(
        'input[type="radio"], input[type="checkbox"], input[type="text"], input[type="number"], textarea, select',
      );
      const wordScore = QUESTION_WORDS.filter((word) => text.includes(word))
        .length;
      const confidence = Math.min(
        0.85,
        0.35 + wordScore * 0.12 + Math.min(inputs.length, 4) * 0.08,
      );
      if (confidence < 0.5) {
        return null;
      }
      const choiceSelector = [
        "label",
        "li",
        "option",
        "button",
        "a",
        "[role='button']",
        ".answer",
        ".choice",
        ".option",
        "[class*='answer']",
        "[class*='choice']",
        "[class*='option']",
      ].join(",");
      const choices = Array.from(root.querySelectorAll(choiceSelector))
        .map((choice, choiceIndex) => ({
          id: String.fromCharCode(65 + choiceIndex),
          text: visibleText(choice),
        }))
        .filter((choice, choiceIndex, allChoices) => {
          if (!choice.text || choice.text.length > 300) {
            return false;
          }
          if (/次の問題|送信|戻る|ホーム|お問い合わせ|ログイン/.test(choice.text)) {
            return false;
          }
          return allChoices.findIndex((item) => item.text === choice.text) === choiceIndex;
        })
        .slice(0, 12);
      const firstInput = inputs[0];
      const mathLatex = extractMath(root);
      const subject = inferSubject(text, mathLatex);
      return baseQuestion(
        {
          questionId: `generic-${index + 1}`,
          stem: text.slice(0, 4000),
          subject,
          answerType: inferAnswerType({
            text,
            choices,
            inputs: Array.from(inputs),
            subject,
            mathLatex,
          }),
          choices,
          mathLatex,
          inputs: Array.from(inputs),
          inputSelector: firstInput ? cssSelector(firstInput) : undefined,
        },
        root,
        "generic_dom",
        confidence,
      );
    })
    .filter(Boolean);
}

function extractQuestions() {
  const viewportQuestion = detectViewportQuestion();
  if (viewportQuestion) {
    return [viewportQuestion];
  }

  const byId = new Map();
  [
    ...detectJsonScriptQuestions(),
    ...detectStructuredQuestions(),
    ...detectGenericQuestions(),
  ].forEach((question) => {
    if (!byId.has(question.questionId)) {
      byId.set(question.questionId, question);
    }
  });
  const questions = Array.from(byId.values()).slice(0, 30);
  if (questions.length) {
    return questions;
  }

  const bodyText = visibleText(document.body).slice(0, 8000);
  const hasVisualProblem =
    document.querySelectorAll("img, canvas, svg, table").length > 0;
  if (!bodyText && !hasVisualProblem) {
    return [];
  }

  const stem =
    bodyText ||
    "DOMから問題文を取得できませんでした。問題本文、表、選択肢がテキストとして公開されていない可能性があります。";
  const mathLatex = extractMath(document.body);
  return [
    baseQuestion(
      {
        questionId: "visual-current-page",
        stem,
        subject: inferSubject(stem, mathLatex),
        answerType: "unknown",
        mathLatex,
      },
      document.body,
      "generic_dom",
      bodyText ? 0.55 : 0.35,
    ),
  ];
}

let lastPayload = "";
let lastHref = location.href;
let timer = 0;
let observer = null;
let floatingStatus = null;
let extensionContextAlive = true;

function stopDetectionRuntime() {
  extensionContextAlive = false;
  globalThis.__YFY_QUESTION_DETECTOR_ACTIVE__ = false;
  globalThis.__YFY_QUESTION_DETECTOR_PUBLISH__ = null;
  window.clearTimeout(timer);
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function sendRuntimeMessage(message) {
  if (!extensionContextAlive) {
    return false;
  }
  try {
    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || "";
        if (
          errorMessage.includes("Extension context invalidated") ||
          errorMessage.includes("Receiving end does not exist")
        ) {
          stopDetectionRuntime();
        }
      }
    });
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Extension context invalidated")
    ) {
      stopDetectionRuntime();
      return false;
    }
    throw error;
  }
}

function publishQuestions({ force = false } = {}) {
  if (!extensionContextAlive) {
    return [];
  }
  let questions = [];
  try {
    questions = extractQuestions();
  } catch (error) {
    console.warn("[Yell for You] question detection failed", error);
    questions = [];
  }
  const payload = JSON.stringify(questions);
  if (!force && payload === lastPayload) {
    return questions;
  }
  lastPayload = payload;
  sendRuntimeMessage({
    type: "DETECTED_QUESTIONS",
    questions,
    pageUrl: location.href,
    pageTitle: document.title,
  });
  return questions;
}

function schedulePublish() {
  window.clearTimeout(timer);
  timer = window.setTimeout(publishQuestions, 350);
}

function startObserver() {
  if (!extensionContextAlive) {
    return;
  }
  if (observer) {
    observer.disconnect();
  }
  lastPayload = "";
  lastHref = location.href;
  publishQuestions({ force: true });
  observer = new MutationObserver(() => {
  if (lastHref !== location.href) {
    lastHref = location.href;
    lastPayload = "";
  }
  schedulePublish();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

globalThis.__YFY_QUESTION_DETECTOR_PUBLISH__ = publishQuestions;

function updateFloatingStatus(message) {
  if (floatingStatus) {
    floatingStatus.textContent = message;
  }
}

function createFloatingControls() {
  if (
    window.top !== window ||
    isAppPage() ||
    document.getElementById("yfy-question-detect-widget")
  ) {
    return;
  }
  const widget = document.createElement("div");
  widget.id = "yfy-question-detect-widget";
  widget.style.cssText = [
    "position:fixed",
    "right:18px",
    "bottom:18px",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "gap:8px",
    "padding:10px",
    "border-radius:999px",
    "background:rgba(255,255,255,.96)",
    "box-shadow:0 12px 34px rgba(0,0,0,.18)",
    "border:1px solid rgba(0,0,0,.12)",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ].join(";");

  const detectButton = document.createElement("button");
  detectButton.type = "button";
  detectButton.textContent = "検知";
  detectButton.style.cssText = [
    "height:38px",
    "border:0",
    "border-radius:999px",
    "background:#1d1d1f",
    "color:#fff",
    "padding:0 16px",
    "font-size:14px",
    "font-weight:700",
    "cursor:pointer",
  ].join(";");

  const restartButton = document.createElement("button");
  restartButton.type = "button";
  restartButton.textContent = "再検知";
  restartButton.style.cssText = [
    "height:38px",
    "border:1px solid rgba(0,0,0,.12)",
    "border-radius:999px",
    "background:#fff",
    "color:#1d1d1f",
    "padding:0 14px",
    "font-size:13px",
    "font-weight:700",
    "cursor:pointer",
  ].join(";");

  floatingStatus = document.createElement("span");
  floatingStatus.textContent = "待機中";
  floatingStatus.style.cssText = [
    "display:inline-block",
    "min-width:56px",
    "font-size:12px",
    "font-weight:700",
    "color:#6e6e73",
    "white-space:nowrap",
  ].join(";");

  detectButton.addEventListener("click", () => {
    const questions = publishQuestions({ force: true });
    updateFloatingStatus(`${questions.length}問`);
  });

  restartButton.addEventListener("click", () => {
    startObserver();
    const questions = publishQuestions({ force: true });
    updateFloatingStatus(`${questions.length}問`);
  });

  widget.append(detectButton, restartButton, floatingStatus);
  document.documentElement.appendChild(widget);
}

// ドラッグで範囲を選択するオーバーレイ。選択後は自身を取り除いてから
// rect（CSSピクセル・ビューポート基準）を返す。スクショはサイドパネル側が
// オーバーレイ消滅後に撮るので、選択UIは写り込まない。
function startRegionSelection(sendResponse) {
  document.getElementById("yfy-region-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "yfy-region-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    cursor: "crosshair",
    background: "rgba(15, 23, 42, 0.2)",
  });

  const hint = document.createElement("div");
  hint.textContent = "ドラッグで解答したい範囲を選択（Escで中止）";
  Object.assign(hint.style, {
    position: "fixed",
    top: "14px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15, 23, 42, 0.88)",
    color: "#ffffff",
    padding: "7px 16px",
    borderRadius: "999px",
    font: "12px/1.4 -apple-system, 'Hiragino Sans', sans-serif",
    pointerEvents: "none",
  });

  const box = document.createElement("div");
  Object.assign(box.style, {
    position: "fixed",
    border: "2px dashed #facc15",
    boxShadow: "0 0 0 100000px rgba(15, 23, 42, 0.3)",
    display: "none",
    pointerEvents: "none",
  });

  overlay.append(hint, box);

  let startPoint = null;
  let lastRect = null;
  let finished = false;

  const cleanup = () => {
    window.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
  };

  const finish = (rect) => {
    if (finished) {
      return;
    }
    finished = true;
    cleanup();
    if (rect && rect.width >= 8 && rect.height >= 8) {
      sendResponse({
        ok: true,
        rect,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        dpr: window.devicePixelRatio || 1,
      });
    } else {
      sendResponse({ ok: false, cancelled: true });
    }
  };

  const rectFrom = (event) => {
    if (!startPoint) {
      return null;
    }
    const x1 = Math.max(0, Math.min(startPoint.x, event.clientX));
    const y1 = Math.max(0, Math.min(startPoint.y, event.clientY));
    const x2 = Math.min(window.innerWidth, Math.max(startPoint.x, event.clientX));
    const y2 = Math.min(window.innerHeight, Math.max(startPoint.y, event.clientY));
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    }
  };

  overlay.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startPoint = { x: event.clientX, y: event.clientY };
    overlay.style.background = "transparent";
    hint.style.display = "none";
  });

  overlay.addEventListener("mousemove", (event) => {
    const rect = rectFrom(event);
    if (!rect) {
      return;
    }
    lastRect = rect;
    Object.assign(box.style, {
      display: "block",
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  });

  overlay.addEventListener("mouseup", (event) => {
    event.preventDefault();
    event.stopPropagation();
    finish(rectFrom(event) || lastRect);
  });

  window.addEventListener("keydown", onKeyDown, true);
  document.documentElement.appendChild(overlay);
}

try {
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "DETECT_NOW") {
    publishQuestions({ force: true });
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "RESTART_DETECTION") {
    startObserver();
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "SELECT_REGION") {
    startRegionSelection(sendResponse);
    return true;
  }
  return false;
});

startObserver();
createFloatingControls();
} catch (error) {
  if (
    error instanceof Error &&
    error.message.includes("Extension context invalidated")
  ) {
    stopDetectionRuntime();
  } else {
    throw error;
  }
}
})();
