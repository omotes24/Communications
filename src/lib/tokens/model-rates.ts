const gpt56LunaModel = "gpt-5.6-luna";
const gpt56TerraModel = "gpt-5.6-terra";
const gpt54NanoModel = "gpt-5.4-nano";

function matchesModel(model: string, candidate: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized === candidate || normalized.startsWith(`${candidate}-`);
}

export function adjustTextReservationForModel(
  model: string,
  estimatedAmount: number,
): number {
  if (matchesModel(model, gpt56LunaModel)) {
    return Math.max(1, Math.ceil(estimatedAmount * 0.2));
  }

  if (matchesModel(model, gpt56TerraModel)) {
    return Math.max(1, Math.ceil(estimatedAmount * 0.5));
  }

  if (matchesModel(model, gpt54NanoModel)) {
    // Output is the slightly more expensive dimension (1/24 of Sol), so use
    // that ratio to keep the reservation conservative for mixed input/output.
    return Math.max(1, Math.ceil(estimatedAmount / 24));
  }

  return estimatedAmount;
}
