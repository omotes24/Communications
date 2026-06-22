export type AudioSourceKind = "local-mic" | "remote-display";

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("このブラウザはマイク入力に対応していません");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}

export async function requestDisplayAudio(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("このブラウザは画面音声共有に対応していません");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
    systemAudio: "include",
    surfaceSwitching: "include",
  } as DisplayMediaStreamOptions);

  if (stream.getAudioTracks().length === 0) {
    stopMediaStream(stream);
    throw new Error(
      "音声トラックを取得できませんでした。共有ダイアログでタブ音声を有効にしてください。",
    );
  }
  return stream;
}
