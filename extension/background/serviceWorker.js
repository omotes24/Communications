const tabQuestions = new Map();
const tabFrameDetections = new Map();

function notifyRuntime(message) {
  chrome.runtime.sendMessage(message, () => {
    // The side panel may be closed; that is not an actionable error.
    void chrome.runtime.lastError;
  });
}

function sendDetectionToTab(tabId, message, sendResponse, retry = true) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (!chrome.runtime.lastError) {
      sendResponse(response || { ok: true });
      return;
    }

    if (!retry) {
      sendResponse({
        ok: false,
        error: "このタブでは検知を実行できません。",
      });
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId, allFrames: true },
        files: ["content/index.js"],
      },
      () => {
        if (chrome.runtime.lastError) {
          sendResponse({
            ok: false,
            error: "このタブでは検知を実行できません。",
          });
          return;
        }
        setTimeout(() => sendDetectionToTab(tabId, message, sendResponse, false), 80);
      },
    );
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

async function getApiBaseUrl() {
  const values = await chrome.storage.sync.get({
    apiBaseUrl: "https://www.yell-for-you.jp",
  });
  return String(values.apiBaseUrl).replace(/\/$/, "");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "DETECTED_QUESTIONS" && sender.tab?.id) {
    const tabId = sender.tab.id;
    const topPageUrl = sender.tab.url || "";
    const currentFrames = tabFrameDetections.get(tabId);
    const frames =
      currentFrames?.topPageUrl === topPageUrl
        ? currentFrames.frames
        : new Map();

    frames.set(sender.frameId ?? 0, {
      questions: message.questions || [],
      pageUrl: message.pageUrl || topPageUrl,
      pageTitle: message.pageTitle || sender.tab.title || "",
    });
    tabFrameDetections.set(tabId, { topPageUrl, frames });

    const byId = new Map();
    for (const frame of frames.values()) {
      for (const question of frame.questions || []) {
        if (!byId.has(question.questionId)) {
          byId.set(question.questionId, question);
        }
      }
    }

    tabQuestions.set(tabId, {
      questions: Array.from(byId.values()).slice(0, 12),
      pageUrl: topPageUrl,
      pageTitle: message.pageTitle || sender.tab.title || "",
    });
    notifyRuntime({
      type: "QUESTIONS_UPDATED",
      tabId,
      ...tabQuestions.get(tabId),
    });
    return false;
  }

  if (message?.type === "GET_QUESTIONS") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      sendResponse(tabId ? tabQuestions.get(tabId) || { questions: [] } : { questions: [] });
    });
    return true;
  }

  if (
    message?.type === "RUN_DETECTION" ||
    message?.type === "RESTART_DETECTION"
  ) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "対象タブが見つかりません。" });
        return;
      }
      if (message.type === "RESTART_DETECTION") {
        tabFrameDetections.delete(tabId);
        tabQuestions.set(tabId, {
          questions: [],
          pageUrl: tabs[0]?.url || "",
          pageTitle: tabs[0]?.title || "",
        });
      }
      sendDetectionToTab(
        tabId,
        {
          type:
            message.type === "RUN_DETECTION"
              ? "DETECT_NOW"
              : "RESTART_DETECTION",
        },
        sendResponse,
      );
    });
    return true;
  }

  if (message?.type === "OPEN_SIDE_PANEL") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "対象タブが見つかりません。" });
      return false;
    }
    chrome.sidePanel.open({ tabId }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          error: "サイドパネルを開けませんでした。",
        });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "SOLVE_QUESTION") {
    (async () => {
      try {
        const apiBaseUrl = await getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/solve-question`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: message.question,
            mode: message.mode || "explanation",
            language: "ja",
          }),
        });
        const data = await response.json();
        sendResponse({ ok: response.ok, data });
      } catch (error) {
        sendResponse({
          ok: false,
          data: {
            error:
              error instanceof Error
                ? error.message
                : "解答生成に失敗しました。",
          },
        });
      }
    })();
    return true;
  }

  return false;
});
