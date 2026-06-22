"use client";

import { useMemo, useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { AnswerWorkbench } from "@/components/answer/AnswerWorkbench";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { FormField, textareaClassName } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";

const practiceCategories = [
  "自己紹介",
  "志望動機",
  "転職理由",
  "強み・弱み",
  "実績",
  "失敗経験",
  "マネジメント",
  "ケース質問",
  "逆質問",
];

const questionBank: Record<string, string[]> = {
  自己紹介: ["簡単に自己紹介をお願いします。"],
  志望動機: ["当社を志望した理由を教えてください。"],
  転職理由: ["今回転職を考えている理由を教えてください。"],
  "強み・弱み": ["あなたの強みと、それを発揮した具体例を教えてください。"],
  実績: ["これまで最も成果を出した経験について教えてください。"],
  失敗経験: ["失敗経験と、そこから学んだことを教えてください。"],
  マネジメント: ["メンバーを支援した経験について教えてください。"],
  ケース質問: ["売上が伸び悩むサービスを改善するなら何から確認しますか。"],
  逆質問: ["最後に当社への質問はありますか。"],
};

function evaluateAnswer(answer: string): string[] {
  const suggestions: string[] = [];
  if (answer.length < 80) {
    suggestions.push(
      "回答が短いため、背景・行動・結果を1つずつ補うと伝わりやすくなります。",
    );
  }
  if (!/(結果|成果|改善|達成|学び)/.test(answer)) {
    suggestions.push("結果や学びを明示すると、面接官が評価しやすくなります。");
  }
  if (!/(まず|結論|私)/.test(answer)) {
    suggestions.push("結論から始めると、回答の方向性が早く伝わります。");
  }
  return suggestions.length
    ? suggestions
    : ["質問に直接答えられています。具体例の再現性も確認してください。"];
}

export function PracticeScreen() {
  const [category, setCategory] = useState(practiceCategories[0]);
  const [question, setQuestion] = useState(
    questionBank[practiceCategories[0]][0],
  );
  const [userAnswer, setUserAnswer] = useState("");

  const suggestions = useMemo(() => evaluateAnswer(userAnswer), [userAnswer]);

  function nextQuestion() {
    const candidates = questionBank[category] ?? questionBank["自己紹介"];
    setQuestion(candidates[Math.floor(Math.random() * candidates.length)]);
  }

  return (
    <section>
      <PageHeader
        title="面接練習"
        description="面接官役の質問に回答し、回答内容の評価、改善点、回答例、STAR整理、深掘り質問を確認します。"
      />
      <div className="grid gap-4">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm font-medium">
              <span>質問カテゴリー</span>
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setQuestion(
                    questionBank[event.target.value]?.[0] ?? question,
                  );
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3"
              >
                {practiceCategories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={nextQuestion}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden />
              次の質問
            </button>
          </div>
          <p className="mt-4 rounded-md bg-slate-50 p-4 text-base font-medium">
            {question}
          </p>
        </section>

        <AudioCapturePanel />

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <FormField label="自分の回答">
            <textarea
              className={textareaClassName}
              value={userAnswer}
              onChange={(event) => setUserAnswer(event.target.value)}
              placeholder="マイク文字起こしを見ながら、回答をここに貼り付けても構いません。"
            />
          </FormField>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-3">
              <h2 className="text-sm font-semibold">評価・改善点</h2>
              <ul className="mt-2 grid gap-2 text-sm text-slate-700">
                {suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <h2 className="text-sm font-semibold">STAR整理</h2>
              <dl className="mt-2 grid gap-1 text-sm text-slate-700">
                <div>Situation: 背景を1文で補足</div>
                <div>Task: 自分の役割を明確化</div>
                <div>Action: 具体的な行動を中心に説明</div>
                <div>Result: 成果または学びで締める</div>
              </dl>
            </div>
          </div>
        </section>

        <AnswerWorkbench
          key={question}
          mode="practice"
          initialQuestion={question}
          autoSource="practice"
        />
      </div>
    </section>
  );
}
