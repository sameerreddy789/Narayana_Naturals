import { StoreError } from "./commerce";

export type BackendMode = "demo" | "emulator" | "firebase";
export type StoreStage = "private-draft" | "production";
export type StoreConfiguration = {
  backendMode: BackendMode;
  storeStage: StoreStage;
  privateDraft: boolean;
  commerceRoot: "commerceDraft" | "commerce";
  appCheckDebug: boolean;
};

export function resolveStoreConfiguration(values: { mode?: string; stage?: string; appCheckDebug?: string } = {}): StoreConfiguration {
  const mode = values.mode ?? "firebase";
  const stage = values.stage ?? "production";
  const debug = values.appCheckDebug ?? "false";
  if (!(["demo", "emulator", "firebase"] as string[]).includes(mode) ||
      !(["private-draft", "production"] as string[]).includes(stage) ||
      !["true", "false"].includes(debug) ||
      (debug === "true" && (mode !== "firebase" || stage !== "private-draft"))) throw new StoreError("CONFIG_REQUIRED");
  return {
    backendMode: mode as BackendMode,
    storeStage: stage as StoreStage,
    privateDraft: stage === "private-draft",
    commerceRoot: stage === "private-draft" ? "commerceDraft" : "commerce",
    appCheckDebug: debug === "true",
  };
}

export function assertPreviewAllowed(preview: unknown, configuration: Pick<StoreConfiguration, "backendMode" | "privateDraft">): void {
  if (preview === true && configuration.backendMode === "firebase" && !configuration.privateDraft) throw new StoreError("STORE_NOT_READY");
}
