"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import {
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  FormField,
  inputClassName,
  textareaClassName,
} from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  createEmptyUserProfile,
  type ProfileFileImportOutput,
  type UserProfile,
} from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

const profileImportAccept =
  "application/pdf,.pdf,.txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json";

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

function needsExpansion(text: string): boolean {
  return text.length > 260 || text.split("\n").length > 8;
}

const collapsedProfilePreviewStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 8,
  overflow: "hidden",
};

export function ProfileManager() {
  const {
    storage,
    activeProfile: storedActiveProfile,
    activeProfiles,
    actions,
  } = useAppStorage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const didLoadInitialProfileRef = useRef(false);
  const [draft, setDraft] = useState<UserProfile>(createEmptyUserProfile());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selfText, setSelfText] = useState("");
  const [forbiddenInformation, setForbiddenInformation] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [fileImportLoading, setFileImportLoading] = useState(false);
  const [expandedProfileIds, setExpandedProfileIds] = useState<string[]>([]);

  const firstProfile = storage.profiles[0] ?? null;
  const initialProfile = storedActiveProfile ?? firstProfile;
  const selectedProfile = useMemo(
    () => storage.profiles.find((profile) => profile.id === selectedId) ?? null,
    [selectedId, storage.profiles],
  );
  const isSavedDraft = storage.profiles.some(
    (profile) => profile.id === draft.id,
  );

  useEffect(() => {
    if (didLoadInitialProfileRef.current || !initialProfile) {
      return undefined;
    }
    didLoadInitialProfileRef.current = true;
    const timer = window.setTimeout(() => {
      setSelectedId(initialProfile.id);
      setDraft(initialProfile);
      setSelfText(profileToSelfText(initialProfile));
      setForbiddenInformation(initialProfile.forbiddenInformation);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialProfile]);

  const selectProfile = useCallback(
    (profile: UserProfile) => {
      setSelectedId(profile.id);
      setDraft(profile);
      setSelfText(profileToSelfText(profile));
      setForbiddenInformation(profile.forbiddenInformation);
      setImportStatus(null);
    },
    [],
  );

  function save() {
    const now = new Date().toISOString();
    const next: UserProfile = {
      ...draft,
      label: draft.label.trim() || "メインプロフィール",
      nameOrAlias: draft.nameOrAlias.trim(),
      affiliation: draft.affiliation.trim(),
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
    setImportStatus(
      "新規スロットを入力できます。保存すると自分フォルダに追加されます。",
    );
  }

  function toggleExpandedProfile(id: string) {
    setExpandedProfileIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function buildCurrentProfile(): UserProfile {
    return {
      ...draft,
      careerSummary: selfText,
      forbiddenInformation,
    };
  }

  async function importProfileFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("currentProfile", JSON.stringify(buildCurrentProfile()));
    const response = await fetch("/api/import-profile-file", {
      method: "POST",
      headers: {
        "x-operation-id": crypto.randomUUID(),
        "x-request-id": crypto.randomUUID(),
      },
      body: formData,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "ファイル内容のAI整理に失敗しました。");
    }

    return (await response.json()) as ProfileFileImportOutput;
  }

  async function handleProfileFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      setFileImportLoading(true);
      setImportStatus(
        "ファイルを読み込み、AIでプロフィール下書きを作成中です。",
      );
      const imported = await importProfileFile(file);
      setDraft((current) => ({
        ...current,
        label: imported.label || current.label,
        nameOrAlias: imported.nameOrAlias,
        affiliation: imported.affiliation,
      }));
      setSelfText(imported.selfText);
      setForbiddenInformation(imported.forbiddenInformation);
      setImportStatus(
        "ファイル内容をフォームに反映しました。内容を確認して保存してください。",
      );
    } catch (error) {
      setImportStatus(
        error instanceof Error
          ? error.message
          : "ファイル読み込みに失敗しました。",
      );
    } finally {
      setFileImportLoading(false);
    }
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
  }, [actions, selectProfile]);

  return (
    <section>
      <PageHeader title="自分スロット" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] sm:p-6">
          <div className="grid gap-5">
            <div className="rounded-[26px] bg-[#f5f5f7] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                    File Import
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">
                    入力の手間を省く
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#6e6e73]">
                    自己紹介、ES、面接準備メモを読み込み、AIがプロフィール下書きへ整理します。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileImportLoading}
                  className="inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-5 py-3 text-center text-sm font-semibold leading-5 text-white transition hover:bg-[#424245] disabled:cursor-not-allowed disabled:bg-[#86868b]"
                >
                  {fileImportLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileUp className="h-4 w-4" aria-hidden />
                  )}
                  <span className="min-w-0">ファイルをアップロード</span>
                </button>
              </div>
              <p className="mt-3 text-xs font-medium leading-5 text-[#6e6e73]">
                対応形式: PDF, txt, md, csv,
                json。PDFはサーバー側で文字抽出してからAIが整理します。
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={profileImportAccept}
                className="hidden"
                onChange={handleProfileFileChange}
              />
            </div>

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

            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="名前">
                <input
                  className={inputClassName}
                  value={draft.nameOrAlias}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nameOrAlias: event.target.value,
                    }))
                  }
                  placeholder="例: 山田 太郎"
                />
              </FormField>

              <FormField label="在籍している大学・学年・学部・研究室など">
                <textarea
                  className={`${textareaClassName} min-h-28`}
                  value={draft.affiliation}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      affiliation: event.target.value,
                    }))
                  }
                  placeholder="例: 慶應義塾大学 理工学部 4年 中澤・大越研究室"
                />
              </FormField>
            </div>

            <FormField label="自分スロット">
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
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                <Save className="h-4 w-4" aria-hidden />
                {isSavedDraft ? "保存" : "新規スロット保存"}
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
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                Profile
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">
                自分フォルダ
              </h2>
              <p className="mt-1 text-xs font-semibold text-[#86868b]">
                {activeProfiles.length}件を回答に使用
              </p>
            </div>
            <button
              type="button"
              onClick={createNew}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#1d1d1f] px-3 text-xs font-semibold text-white transition hover:bg-[#424245]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              追加
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {storage.profiles.length === 0 ? (
              <p className="rounded-2xl bg-[#f5f5f7] p-4 text-sm font-medium text-[#6e6e73]">
                まだ保存されていません。
              </p>
            ) : (
              storage.profiles.map((profile, index) => {
                const inUse = activeProfiles.some(
                  (item) => item.id === profile.id,
                );
                const profileText = profile.careerSummary || "内容未入力";
                const canExpand = needsExpansion(profileText);
                const expanded = expandedProfileIds.includes(profile.id);
                return (
                  <div
                    key={profile.id}
                    className={cn(
                      "rounded-2xl p-2.5 ring-1 ring-black/[0.06] transition",
                      selectedProfile?.id === profile.id
                        ? "bg-[#f5f5f7] text-[#1d1d1f]"
                        : "bg-white text-[#1d1d1f] hover:bg-[#fbfbfd]",
                    )}
                  >
                  <button
                    type="button"
                    onClick={() => selectProfile(profile)}
                    className="block w-full text-left"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                        SLOT {String.fromCharCode(65 + index)}
                      </span>
                      {inUse ? (
                        <CheckCircle2
                          className="h-4 w-4 text-emerald-600"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold">
                      {profile.label}
                    </span>
                    {expanded && (profile.nameOrAlias || profile.affiliation) ? (
                      <span className="mt-1 block whitespace-pre-wrap text-xs font-semibold text-[#6e6e73]">
                        {[profile.nameOrAlias, profile.affiliation]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "mt-1.5 block text-[11px] leading-4",
                        expanded ? "whitespace-pre-wrap" : "whitespace-normal",
                        selectedProfile?.id === profile.id
                          ? "text-[#6e6e73]"
                          : "text-[#86868b]",
                      )}
                      style={expanded ? undefined : collapsedProfilePreviewStyle}
                    >
                      {profileText}
                    </span>
                  </button>
                  {canExpand ? (
                    <button
                      type="button"
                      onClick={() => toggleExpandedProfile(profile.id)}
                      className="mt-1.5 inline-flex h-6 items-center rounded-full bg-[#f5f5f7] px-2.5 text-[11px] font-semibold text-[#6e6e73] transition hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
                      aria-expanded={expanded}
                    >
                      {expanded ? "閉じる" : "全文"}
                    </button>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => actions.toggleSelectedProfile(profile.id)}
                      aria-pressed={inUse}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition",
                        inUse
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e8e8ed]",
                      )}
                    >
                      {inUse ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <span
                          className="h-3.5 w-3.5 rounded-full ring-1 ring-[#c7c7cc]"
                          aria-hidden
                        />
                      )}
                      {inUse ? "チェック中" : "チェック"}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500">
                        {new Date(profile.updatedAt).toLocaleDateString(
                          "ja-JP",
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label={`${profile.label}を削除`}
                        onClick={() => actions.deleteProfile(profile.id)}
                        className={cn(
                          "rounded-full p-1.5 transition",
                          selectedProfile?.id === profile.id
                            ? "text-red-600 hover:bg-red-50"
                            : "text-[#86868b] hover:bg-red-50 hover:text-red-600",
                        )}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
