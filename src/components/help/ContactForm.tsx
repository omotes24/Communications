"use client";

import { useState } from "react";
import { ImagePlus, Send } from "lucide-react";

const categoryOptions = [
  { value: "billing", label: "課金・トークン" },
  { value: "account", label: "アカウント" },
  { value: "bug", label: "不具合" },
  { value: "privacy", label: "プライバシー・削除" },
  { value: "other", label: "その他" },
] as const;

type ContactResponse = {
  ok?: boolean;
  error?: string;
};

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/help/contact", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ContactResponse;

      if (!response.ok) {
        throw new Error(data.error || "送信に失敗しました。");
      }

      form.reset();
      setSelectedImages([]);
      setMessage("送信しました。内容を確認して返信します。");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "送信に失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          お名前
          <input
            name="name"
            required
            maxLength={80}
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          返信先メールアドレス
          <input
            name="email"
            type="email"
            required
            maxLength={160}
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          種別
          <select
            name="category"
            required
            defaultValue="other"
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          件名
          <input
            name="subject"
            required
            maxLength={120}
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold">
        内容
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={8}
          className="resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-base leading-7 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold">
        画像
        <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-dashed border-black/15 bg-white px-4 py-3 text-sm font-semibold text-[#424245] transition hover:border-[var(--accent)]">
          <ImagePlus className="h-4 w-4 text-[var(--accent)]" aria-hidden />
          <span>画像を添付</span>
          <input
            name="images"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(event) => {
              setSelectedImages(Array.from(event.currentTarget.files ?? []));
            }}
          />
        </span>
      </label>

      {selectedImages.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedImages.map((file) => (
            <span
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="rounded-full bg-[#f5f5f7] px-3 py-1.5 text-xs font-semibold text-[#424245]"
            >
              {file.name}
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
          {message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden />
          {loading ? "送信中..." : "送信する"}
        </button>
      </div>
    </form>
  );
}
