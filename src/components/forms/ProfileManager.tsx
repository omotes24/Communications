"use client";

import { useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";

import {
  FormField,
  inputClassName,
  textareaClassName,
} from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  createEmptyUserProfile,
  type UserProfile,
} from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";

const fields: Array<[keyof UserProfile, string, "input" | "textarea"]> = [
  ["label", "表示名", "input"],
  ["nameOrAlias", "氏名または呼称", "input"],
  ["currentRole", "現在の職種", "input"],
  ["careerSummary", "経歴概要", "textarea"],
  ["workHistory", "職歴", "textarea"],
  ["skills", "スキル", "textarea"],
  ["strengths", "強み", "textarea"],
  ["weaknesses", "弱み", "textarea"],
  ["achievements", "実績", "textarea"],
  ["metrics", "成果数値", "textarea"],
  ["successStories", "成功経験", "textarea"],
  ["failureStories", "失敗経験", "textarea"],
  ["managementExperience", "マネジメント経験", "textarea"],
  ["careerChangeReason", "転職理由", "textarea"],
  ["motivationMaterials", "志望動機の素材", "textarea"],
  ["preferredTone", "希望する話し方", "textarea"],
  ["forbiddenInformation", "回答で絶対に使わない情報", "textarea"],
];

export function ProfileManager() {
  const { storage, actions } = useAppStorage();
  const firstProfile = storage.profiles[0];
  const [draft, setDraft] = useState<UserProfile>(
    firstProfile ?? createEmptyUserProfile(),
  );

  const savedIds = useMemo(
    () => new Set(storage.profiles.map((item) => item.id)),
    [storage.profiles],
  );

  function updateField(key: keyof UserProfile, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    actions.saveProfile({ ...draft, updatedAt: new Date().toISOString() });
  }

  return (
    <section>
      <PageHeader
        title="ユーザー情報登録"
        description="回答案の根拠として使える本人情報だけを登録します。回答で使わない情報は明示しておくと生成時に除外しやすくなります。"
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
              onClick={() => setDraft(createEmptyUserProfile())}
              className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium"
            >
              新規作成
            </button>
          </div>
        </form>
        <aside className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">登録済み</h2>
          <div className="mt-3 grid gap-2">
            {storage.profiles.length === 0 ? (
              <p className="text-sm text-slate-500">まだ登録がありません。</p>
            ) : (
              storage.profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <button
                    type="button"
                    onClick={() => setDraft(profile)}
                    className="block w-full text-left text-sm font-medium"
                  >
                    {profile.label}
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {new Date(profile.updatedAt).toLocaleString("ja-JP")}
                    </span>
                    {savedIds.has(profile.id) ? (
                      <button
                        type="button"
                        aria-label={`${profile.label}を削除`}
                        onClick={() => actions.deleteProfile(profile.id)}
                        className="rounded p-1 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
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
