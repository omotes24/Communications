"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";

import {
  FormField,
  inputClassName,
  textareaClassName,
} from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  createEmptyCompanyProfile,
  type CompanyProfile,
} from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";

const fields: Array<[keyof CompanyProfile, string, "input" | "textarea"]> = [
  ["label", "表示名", "input"],
  ["companyName", "会社名", "input"],
  ["business", "事業内容", "textarea"],
  ["philosophy", "企業理念", "textarea"],
  ["targetRole", "応募職種", "input"],
  ["jobDescription", "求人票", "textarea"],
  ["requiredSkills", "求められるスキル", "textarea"],
  ["interviewFocus", "面接で重視されそうな事項", "textarea"],
  ["attraction", "ユーザーが感じている企業の魅力", "textarea"],
  ["reverseQuestions", "逆質問候補", "textarea"],
];

export function CompanyManager() {
  const { storage, actions } = useAppStorage();
  const [draft, setDraft] = useState<CompanyProfile>(
    storage.companies[0] ?? createEmptyCompanyProfile(),
  );

  function updateField(key: keyof CompanyProfile, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    actions.saveCompany({ ...draft, updatedAt: new Date().toISOString() });
  }

  return (
    <section>
      <PageHeader
        title="企業・求人情報登録"
        description="応募企業と求人票の情報を登録します。志望動機、逆質問、求められるスキルとの接続に使います。"
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(([key, label, kind]) => (
              <FormField key={key} label={label}>
                {kind === "input" ? (
                  <input
                    className={inputClassName}
                    value={String(draft[key])}
                    onChange={(event) => updateField(key, event.target.value)}
                  />
                ) : (
                  <textarea
                    className={textareaClassName}
                    value={String(draft[key])}
                    onChange={(event) => updateField(key, event.target.value)}
                  />
                )}
              </FormField>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white"
            >
              <Save className="h-4 w-4" aria-hidden />
              保存
            </button>
            <button
              type="button"
              onClick={() => setDraft(createEmptyCompanyProfile())}
              className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium"
            >
              新規作成
            </button>
          </div>
        </form>
        <aside className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">登録済み</h2>
          <div className="mt-3 grid gap-2">
            {storage.companies.length === 0 ? (
              <p className="text-sm text-slate-500">まだ登録がありません。</p>
            ) : (
              storage.companies.map((company) => (
                <div
                  key={company.id}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <button
                    type="button"
                    onClick={() => setDraft(company)}
                    className="block w-full text-left text-sm font-medium"
                  >
                    {company.label}
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {new Date(company.updatedAt).toLocaleString("ja-JP")}
                    </span>
                    <button
                      type="button"
                      aria-label={`${company.label}を削除`}
                      onClick={() => actions.deleteCompany(company.id)}
                      className="rounded p-1 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
