"use client";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { usePreview } from "./preview-provider";

export function DataStatus({ loading, error = "", onRetry }: { loading?: string; error?: string; onRetry?: () => void }) {
  const { t, retryConnection, offline } = usePreview();
  return <div className="data-status" role={error ? "alert" : "status"}>
    {error && <AlertCircle size={21} aria-hidden="true" />}
    <p>{error || loading}</p>
    {error && <button type="button" className="button secondary" disabled={!onRetry && offline} onClick={onRetry ?? retryConnection}>{t("Try again", "మళ్లీ ప్రయత్నించండి")}<RefreshCw size={16} /></button>}
  </div>;
}

export function ConnectionBanner() {
  const { mode, offline, connectionError, t, retryConnection } = usePreview();
  if (mode === "demo" || (!offline && !connectionError)) return null;
  return <div className="connection-banner" role="status"><div className="page-width">
    {offline ? <WifiOff size={19} aria-hidden="true" /> : <AlertCircle size={19} aria-hidden="true" />}
    <p>{offline ? t("You are offline. Reconnect to save changes or place an order.", "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు. సేవ్ చేయడానికి లేదా ఆర్డర్ చేయడానికి కనెక్ట్ అవ్వండి.") : connectionError}</p>
    {!offline && <button className="text-button" onClick={retryConnection}>{t("Try again", "మళ్లీ ప్రయత్నించండి")}<RefreshCw size={15} /></button>}
  </div></div>;
}
