import "server-only";

import {
  appStorageSchema,
  type AppStorage,
  type CompanyProfile,
  type SessionRecord,
  type UserProfile,
} from "@/lib/schemas/interview";
import { defaultStorage } from "@/lib/storage/browser-store";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const storageSelect = {
  profiles:
    "id, display_name, created_at, updated_at",
  personalSlots:
    "id, name, content, excluded_content, created_at, updated_at",
  companySlots:
    "id, company_name, website_url, recruitment_url, course_name, source_content, research_summary, detailed_notes, created_at, updated_at",
  sessions:
    "id, company_slot_id, title, started_at, ended_at, explicitly_saved, created_at, updated_at",
  messages:
    "id, session_id, role, message_type, content, model, created_at",
};

export async function loadCloudStorage(userId: string): Promise<{
  storage: AppStorage;
  hasCloudData: boolean;
  importedLocalStorage: boolean;
}> {
  const supabase = createSupabaseServiceClient();
  const [
    personalSlots,
    companySlots,
    sessions,
    messages,
    settings,
    imports,
  ] = await Promise.all([
    supabase
      .from("personal_slots")
      .select(storageSelect.personalSlots)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("company_slots")
      .select(storageSelect.companySlots)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("interview_sessions")
      .select(storageSelect.sessions)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("interview_messages")
      .select(storageSelect.messages)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("local_storage_imports")
      .select("id")
      .eq("user_id", userId)
      .limit(1),
  ]);

  for (const result of [
    personalSlots,
    companySlots,
    sessions,
    messages,
    settings,
    imports,
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const parsedSettings = settings.data?.settings as Partial<AppStorage> | null;
  const personalSlotRows = (personalSlots.data ?? []) as unknown as Record<
    string,
    unknown
  >[];
  const companySlotRows = (companySlots.data ?? []) as unknown as Record<
    string,
    unknown
  >[];
  const sessionRows = (sessions.data ?? []) as unknown as Record<
    string,
    unknown
  >[];
  const messageRows = (messages.data ?? []) as unknown as Record<
    string,
    unknown
  >[];
  const profiles = personalSlotRows
    .map((row) => toProfile(row))
    .filter((profile): profile is UserProfile => Boolean(profile));
  const companies = companySlotRows
    .map((row) => toCompany(row))
    .filter((company): company is CompanyProfile => Boolean(company));
  const history = toHistory(sessionRows, messageRows);
  const storage = appStorageSchema.catch(defaultStorage).parse({
    ...defaultStorage,
    ...parsedSettings,
    profiles,
    companies,
    history,
  });

  return {
    storage,
    hasCloudData:
      profiles.length > 0 ||
      companies.length > 0 ||
      history.length > 0 ||
      Boolean(settings.data),
    importedLocalStorage: Boolean(imports.data?.length),
  };
}

export async function saveCloudStorage(
  userId: string,
  storage: AppStorage,
  options: { allowEmptyOverwrite?: boolean } = {},
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const parsed = appStorageSchema.parse(storage);
  const existing = options.allowEmptyOverwrite
    ? null
    : await loadCloudStorage(userId);

  if (!options.allowEmptyOverwrite && !hasMeaningfulAppStorage(parsed)) {
    if (existing && hasMeaningfulAppStorage(existing.storage)) {
      throw new Error(
        "既存のクラウドデータがあるため、空のデータでは上書きしません。",
      );
    }
  }
  assertNoBlankProfileOverwrite(
    existing?.storage ?? null,
    parsed,
    Boolean(options.allowEmptyOverwrite),
  );

  const profilesToPersist = options.allowEmptyOverwrite
    ? parsed.profiles
    : mergeById(parsed.profiles, existing?.storage.profiles ?? []);
  const companiesToPersist = options.allowEmptyOverwrite
    ? parsed.companies
    : mergeById(parsed.companies, existing?.storage.companies ?? []);

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        display_name:
          parsed.profiles.find((profile) => profile.id === parsed.activeProfileId)
            ?.label ??
          parsed.profiles[0]?.label ??
          "",
      },
      { onConflict: "user_id" },
    );
  if (profileError) {
    throw profileError;
  }

  if (options.allowEmptyOverwrite) {
    await deleteUserRows(userId);
  }

  if (profilesToPersist.length > 0) {
    const { error } = await supabase.from("personal_slots").upsert(
      profilesToPersist.map((profile) => ({
        id: profile.id,
        user_id: userId,
        name: profile.label,
        content: profile,
        excluded_content: profile.forbiddenInformation,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      })),
      { onConflict: "id" },
    );
    if (error) {
      throw error;
    }
  }

  if (companiesToPersist.length > 0) {
    const { error } = await supabase.from("company_slots").upsert(
      companiesToPersist.map((company) => ({
        id: company.id,
        user_id: userId,
        company_name: company.companyName,
        website_url: firstUrl(company.researchInput),
        recruitment_url: company.researchSources[0] ?? "",
        course_name: company.targetRole,
        source_content: company.researchInput,
        research_summary: company.researchSummary,
        detailed_notes: { profile: company },
        created_at: company.createdAt,
        updated_at: company.updatedAt,
      })),
      { onConflict: "id" },
    );
    if (error) {
      throw error;
    }
  }

  if (parsed.history.length > 0) {
    const { error: sessionsError } = await supabase
      .from("interview_sessions")
      .upsert(
        parsed.history.map((record) => ({
          id: record.id,
          user_id: userId,
          title: record.question.slice(0, 80),
          started_at: record.createdAt,
          ended_at: record.createdAt,
          explicitly_saved: true,
          created_at: record.createdAt,
          updated_at: record.createdAt,
        })),
        { onConflict: "id" },
      );
    if (sessionsError) {
      throw sessionsError;
    }

    const sessionIds = parsed.history.map((record) => record.id);
    const { error: deleteMessagesError } = await supabase
      .from("interview_messages")
      .delete()
      .eq("user_id", userId)
      .in("session_id", sessionIds);
    if (deleteMessagesError) {
      throw deleteMessagesError;
    }

    const { error: messagesError } = await supabase
      .from("interview_messages")
      .insert(
        parsed.history.flatMap((record) => [
          {
            user_id: userId,
            session_id: record.id,
            role: "user",
            message_type: "question",
            content: record.question,
            created_at: record.createdAt,
          },
          {
            user_id: userId,
            session_id: record.id,
            role: "assistant",
            message_type: "answer",
            content: JSON.stringify({
              answer: record.answer,
              talkingPoints: record.talkingPoints,
              evidenceUsed: record.evidenceUsed,
              mode: record.mode,
            }),
            created_at: record.createdAt,
          },
        ]),
      );
    if (messagesError) {
      throw messagesError;
    }
  }

  const { error: settingsError } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      settings: {
        activeProfileId: parsed.activeProfileId,
        activeCompanyId: parsed.activeCompanyId,
        selectedProfileIds: parsed.selectedProfileIds,
        selectedCompanyIds: parsed.selectedCompanyIds,
        groupDiscussionSessions: parsed.groupDiscussionSessions,
        learning: parsed.learning,
        privacy: parsed.privacy,
      },
    },
    { onConflict: "user_id" },
  );
  if (settingsError) {
    throw settingsError;
  }
}

export async function importLocalStorageOnce({
  userId,
  storage,
  importId,
  migrationVersion,
}: {
  userId: string;
  storage: AppStorage;
  importId: string;
  migrationVersion: string;
}): Promise<{ imported: boolean; storage: AppStorage }> {
  const supabase = createSupabaseServiceClient();
  const existing = await supabase
    .from("local_storage_imports")
    .select("id")
    .eq("user_id", userId)
    .or(`import_id.eq.${importId},migration_version.eq.${migrationVersion}`)
    .limit(1);
  if (existing.error) {
    throw existing.error;
  }
  if (existing.data?.length) {
    const current = await loadCloudStorage(userId);
    return { imported: false, storage: current.storage };
  }

  await saveCloudStorage(userId, storage);
  const { data, error } = await supabase
    .from("local_storage_imports")
    .insert({
      user_id: userId,
      import_id: importId,
      migration_version: migrationVersion,
    })
    .select("id");
  if (error) {
    if ("code" in error && error.code === "23505") {
      const current = await loadCloudStorage(userId);
      return { imported: false, storage: current.storage };
    }
    throw error;
  }
  if (!data?.length) {
    const current = await loadCloudStorage(userId);
    return { imported: false, storage: current.storage };
  }

  return { imported: true, storage };
}

async function deleteUserRows(userId: string) {
  const supabase = createSupabaseServiceClient();
  const results = await Promise.all([
    supabase.from("interview_messages").delete().eq("user_id", userId),
    supabase.from("interview_sessions").delete().eq("user_id", userId),
    supabase.from("company_slots").delete().eq("user_id", userId),
    supabase.from("personal_slots").delete().eq("user_id", userId),
  ]);
  for (const result of results) {
    if (result.error) {
      throw result.error;
    }
  }
}

function toProfile(row: Record<string, unknown>): UserProfile | null {
  const content = row.content;
  return appStorageSchema.shape.profiles.element
    .nullable()
    .catch(null)
    .parse(content);
}

function toCompany(row: Record<string, unknown>): CompanyProfile | null {
  const detailed = row.detailed_notes;
  const maybeProfile =
    detailed && typeof detailed === "object" && "profile" in detailed
      ? (detailed as { profile?: unknown }).profile
      : null;
  return appStorageSchema.shape.companies.element
    .nullable()
    .catch(null)
    .parse(maybeProfile);
}

function toHistory(
  sessions: Record<string, unknown>[],
  messages: Record<string, unknown>[],
): SessionRecord[] {
  return sessions
    .map((session) => {
      const sessionId = String(session.id);
      const question =
        messages.find(
          (message) =>
            message.session_id === sessionId && message.message_type === "question",
        )?.content ?? "";
      const rawAnswer =
        messages.find(
          (message) =>
            message.session_id === sessionId && message.message_type === "answer",
        )?.content ?? "";
      const answerPayload = parseAnswerPayload(String(rawAnswer));
      return {
        id: sessionId,
        mode: answerPayload.mode,
        question: String(question),
        answer: answerPayload.answer,
        talkingPoints: answerPayload.talkingPoints,
        evidenceUsed: answerPayload.evidenceUsed,
        createdAt: String(session.created_at),
      };
    })
    .filter((record) => record.question && record.answer)
    .map((record) => appStorageSchema.shape.history.element.parse(record));
}

function parseAnswerPayload(value: string): Omit<SessionRecord, "id" | "question" | "createdAt"> {
  try {
    const parsed = JSON.parse(value) as Partial<SessionRecord>;
    return {
      mode: parsed.mode === "practice" ? "practice" : "support",
      answer: String(parsed.answer ?? ""),
      talkingPoints: Array.isArray(parsed.talkingPoints)
        ? parsed.talkingPoints.map(String)
        : [],
      evidenceUsed: Array.isArray(parsed.evidenceUsed)
        ? parsed.evidenceUsed.map(String)
        : [],
    };
  } catch {
    return {
      mode: "support",
      answer: value,
      talkingPoints: [],
      evidenceUsed: [],
    };
  }
}

function firstUrl(text: string): string {
  return text.match(/https?:\/\/[^\s<>"'、。)）]+/)?.[0] ?? "";
}

function hasMeaningfulAppStorage(storage: AppStorage): boolean {
  return (
    storage.profiles.length > 0 ||
    storage.companies.length > 0 ||
    storage.history.length > 0 ||
    storage.groupDiscussionSessions.length > 0 ||
    Boolean(storage.learning)
  );
}

function mergeById<T extends { id: string }>(primary: T[], fallback: T[]): T[] {
  const ids = new Set(primary.map((item) => item.id));
  return [...primary, ...fallback.filter((item) => !ids.has(item.id))];
}

function assertNoBlankProfileOverwrite(
  existing: AppStorage | null,
  next: AppStorage,
  allowEmptyOverwrite: boolean,
): void {
  if (allowEmptyOverwrite || !existing?.profiles.length) {
    return;
  }
  const nextProfiles = new Map(
    next.profiles.map((profile) => [profile.id, profile]),
  );
  for (const existingProfile of existing.profiles) {
    const nextProfile = nextProfiles.get(existingProfile.id);
    if (!nextProfile) {
      continue;
    }
    if (
      hasMeaningfulProfileContent(existingProfile) &&
      !hasMeaningfulProfileContent(nextProfile)
    ) {
      throw new Error(
        "既存の自分フォルダを空の内容で上書きしないよう停止しました。ページを再読み込みしてください。",
      );
    }
  }
}

function hasMeaningfulProfileContent(profile: UserProfile): boolean {
  return [
    profile.nameOrAlias,
    profile.affiliation,
    profile.currentRole,
    profile.careerSummary,
    profile.workHistory,
    profile.skills,
    profile.strengths,
    profile.weaknesses,
    profile.achievements,
    profile.metrics,
    profile.successStories,
    profile.failureStories,
    profile.managementExperience,
    profile.careerChangeReason,
    profile.motivationMaterials,
    profile.forbiddenInformation,
  ].some((value) => value.trim().length > 0);
}
