const tabQuestions = new Map();
const tabFrameDetections = new Map();
// トークン課金残高を使うため、送信先は常に本番サイトに固定する
// （ユーザーが変更できる設定は置かない）。
const API_BASE_URL = "https://communications-umber.vercel.app";

function notifyRuntime(message) {
  chrome.runtime.sendMessage(message, () => {
    // The side panel may be closed; that is not an actionable error.
    void chrome.runtime.lastError;
  });
}

async function parseFetchResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 1200) };
  }
}

async function postSolveQuestion(question, mode) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/solve-question`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        mode: mode || "explanation",
        language: "ja",
      }),
    });
    const data = await parseFetchResponse(response);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: response.ok
        ? data
        : {
            error:
              data.error ||
              `API送信に失敗しました。HTTP ${response.status} ${response.statusText}`,
            details: data,
          },
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        error: error instanceof Error ? error.message : "解答生成に失敗しました。",
      },
    };
  }
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
    postSolveQuestion(message.question, message.mode).then(sendResponse);
    return true;
  }

  if (message?.type === "GET_ACCOUNT") {
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/account/me`, {
          credentials: "include",
        });
        const data = await parseFetchResponse(response);
        sendResponse({
          ok: response.ok,
          status: response.status,
          data,
        });
      } catch (error) {
        sendResponse({
          ok: false,
          status: 0,
          data: {
            error:
              error instanceof Error
                ? error.message
                : "アカウント情報を取得できませんでした。",
          },
        });
      }
    })();
    return true;
  }

  if (message?.type === "OPEN_LOGIN_PAGE") {
    chrome.tabs.create({ url: `${API_BASE_URL}/auth/login` });
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "CAPTURE_VISIBLE_TAB") {
    // service workerには「現在のウィンドウ」が無いため、currentWindowではなく
    // 最後にフォーカスされた通常ウィンドウを基準にする（複数ウィンドウ配置対策）
    chrome.tabs.query(
      { active: true, lastFocusedWindow: true },
      (tabs) => {
        const tab = tabs[0];
        if (!tab?.windowId) {
          sendResponse({
            ok: false,
            error: "アクティブなタブが見つかりません。問題ページのウィンドウを一度クリックしてください。",
          });
          return;
        }
        chrome.tabs.captureVisibleTab(
          tab.windowId,
          { format: "jpeg", quality: 82 },
          (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
              sendResponse({
                ok: false,
                error:
                  chrome.runtime.lastError?.message ||
                  "画面スクリーンショットを取得できませんでした。",
                pageUrl: tab.url || "",
              });
              return;
            }
            sendResponse({
              ok: true,
              dataUrl,
              pageUrl: tab.url || "",
              pageTitle: tab.title || "",
            });
          },
        );
      },
    );
    return true;
  }

  return false;
});
