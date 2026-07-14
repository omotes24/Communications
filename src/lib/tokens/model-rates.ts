const gpt56LunaModel = "gpt-5.6-luna";

export function adjustAnswerReservationForModel(
  model: string,
  estimatedAmount: number,
): number {
  if (model !== gpt56LunaModel) {
    return estimatedAmount;
  }

  return Math.max(1, Math.ceil((estimatedAmount * 4) / 9));
}
