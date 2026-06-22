"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Save, Trash2, UserRound } from "lucide-react";

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
import { cn } from "@/lib/utils";

function profileToSelfText(profile: UserProfile): string {
  return [
    profile.careerSummary,
    profile.strengths ? `強み: ${profile.strengths}` : "",
    profile.weaknesses ? `弱み: ${profile.weaknesses}` : "",
    profile.achievements ? `実績: ${profile.achievements}` : "",
    profile.successStories ? `成功経験: ${profile.successStories}` : "",
    profile.failureStories ? `挫折・苦労: ${profile.failureStories}` : "",
    profile.managementExperience
      ? `リーダー経験: ${profile.managementExperience}`
      : "",
    profile.motivationMaterials
      ? `志望動機の素材: ${profile.motivationMaterials}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function ProfileManager() {
  const { storage, actions } = useAppStorage();
  const [draft, setDraft] = useState<UserProfile>(createEmptyUserProfile());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selfText, setSelfText] = useState("");
  const [forbiddenInformation, setForbiddenInformation] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const firstProfile = storage.profiles[0] ?? null;
  const activeProfile = useMemo(
    () => storage.profiles.find((profile) => profile.id === selectedId) ?? null,
    [selectedId, storage.profiles],
  );

  useEffect(() => {
    if (!selectedId && firstProfile) {
      const timer = window.setTimeout(() => {
        setSelectedId(firstProfile.id);
        setDraft(firstProfile);
        setSelfText(profileToSelfText(firstProfile));
        setForbiddenInformation(firstProfile.forbiddenInformation);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [firstProfile, selectedId]);

  function selectProfile(profile: UserProfile) {
    setSelectedId(profile.id);
    setDraft(profile);
    setSelfText(profileToSelfText(profile));
    setForbiddenInformation(profile.forbiddenInformation);
    setImportStatus(null);
  }

  function save() {
    const now = new Date().toISOString();
    const next: UserProfile = {
      ...draft,
      label: draft.label.trim() || "メインプロフィール",
      careerSummary: selfText,
      strengths: "",
      weaknesses: "",
      achievements: "",
      successStories: "",
      failureStories: "",
      managementExperience: "",
      motivationMaterials: "",
      forbiddenInformation,
      updatedAt: now,
    };
    actions.saveProfile(next);
    setDraft(next);
    setSelectedId(next.id);
    setImportStatus("保存しました。");
  }

  function createNew() {
    const empty = createEmptyUserProfile();
    setDraft(empty);
    setSelectedId(null);
    setSelfText("");
    setForbiddenInformation("");
    setImportStatus(null);
  }

  const importLocalSeed = useCallback(async () => {
    try {
      const response = await fetch("/api/local-profile-seed", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("ローカル下書きを読み込めませんでした");
      }
      const data = (await response.json()) as { profile: UserProfile | null };
      if (!data.profile) {
        setImportStatus("ローカル下書きは見つかりませんでした。");
        return;
      }
      actions.saveProfile(data.profile);
      selectProfile(data.profile);
      setImportStatus("ローカル下書きを取り込みました。");
    } catch (error) {
      setImportStatus(
        error instanceof Error
          ? error.message
          : "ローカル下書きの取り込みに失敗しました。",
      );
    }
  }, [actions]);

  return (
    <section>
      <PageHeader
        title="自分のこと"
        description="面接で使いたい経験、強み、弱み、サークルでの役割、システム開発経験をそのまま貼ります。ここにない内容は回答案に使いません。"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] sm:p-6">
          <div className="grid gap-5">
            <FormField label="プロフィール名">
              <input
                className={inputClassName}
                value={draft.label}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="メインプロフィール"
              />
            </FormField>

            <FormField label="自分のこと">
              <textarea
                className={`${textareaClassName} min-h-[360px]`}
                value={selfText}
                onChange={(event) => setSelfText(event.target.value)}
                placeholder="サークルで部長、システム開発経験、強み、弱み、挫折経験などをまとめて貼り付けます。"
              />
            </FormField>

            <details className="rounded-2xl bg-[#f5f5f7] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#1d1d1f]">
                使わない情報だけ指定する
              </summary>
              <div className="mt-4">
                <FormField label="回答で使わない情報">
                  <textarea
                    className={`${textareaClassName} min-h-28`}
                    value={forbiddenInformation}
                    onChange={(event) =>
                      setForbiddenInformation(event.target.value)
                    }
                    placeholder="面接回答に出したくない情報、触れないでほしい話題"
                  />
                </FormField>
              </div>
            </details>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white transition hover:bg-[#147ce5]"
              >
                <Save className="h-4 w-4" aria-hidden />
                保存
              </button>
              <button
                type="button"
                onClick={importLocalSeed}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f5f5f7] px-5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]"
              >
                <Download className="h-4 w-4" aria-hidden />
                下書き取込
              </button>
              <button
                type="button"
                onClick={createNew}
                className="h-11 rounded-full bg-[#f5f5f7] px-5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]"
              >
                新規
              </button>
            </div>

            {importStatus ? (
              <p className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm font-medium text-[#6e6e73]">
                {importStatus}
              </p>
            ) : null}
          </div>
        </form>

        <aside className="rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0071e3]">
                Profile
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">
                Saved Slot
              </h2>
            </div>
            <UserRound className="h-5 w-5 text-[#86868b]" aria-hidden />
          </div>

          <div className="mt-4 grid gap-2">
            {storage.profiles.length === 0 ? (
              <p className="rounded-2xl bg-[#f5f5f7] p-4 text-sm font-medium text-[#6e6e73]">
                まだ保存されていません。
              </p>
            ) : (
              storage.profiles.map((profile, index) => (
                <div
                  key={profile.id}
                  className={cn(
                    "rounded-2xl p-3 ring-1 ring-black/[0.06] transition",
                    activeProfile?.id === profile.id
                      ? "bg-[#f5f5f7] text-[#1d1d1f]"
                      : "bg-white text-[#1d1d1f] hover:bg-[#fbfbfd]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectProfile(profile)}
                    className="block w-full text-left"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0071e3]">
                      PROFILE {index + 1}
                    </span>
                    <span className="mt-1 block text-sm font-semibold">
                      {profile.label}
                    </span>
                    <span
                      className={cn(
                        "mt-2 line-clamp-3 block text-xs leading-5",
                        activeProfile?.id === profile.id
                          ? "text-[#6e6e73]"
                          : "text-[#86868b]",
                      )}
                    >
                      {profile.careerSummary || "内容未入力"}
                    </span>
                  </button>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[11px]",
                        activeProfile?.id === profile.id
                          ? "text-neutral-500"
                          : "text-neutral-500",
                      )}
                    >
                      {new Date(profile.updatedAt).toLocaleDateString("ja-JP")}
                    </span>
                    <button
                      type="button"
                      aria-label={`${profile.label}を削除`}
                      onClick={() => actions.deleteProfile(profile.id)}
                      className={cn(
                        "rounded-full p-1.5 transition",
                        activeProfile?.id === profile.id
                          ? "text-red-600 hover:bg-red-50"
                          : "text-[#86868b] hover:bg-red-50 hover:text-red-600",
                      )}
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
