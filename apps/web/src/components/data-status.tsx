"use client";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { privateDraft } from "@/lib/firebase";
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

export function PrivateDraftBanner() {
  const { t } = usePreview();
  if (!privateDraft) return null;
  return <div className="demo-banner private-draft-banner">{t("Private demonstration · Example prices: 1 L ₹450, 2 L ₹900, 5 L ₹2,250 · No orders, payments or delivery", "ప్రైవేట్ ప్రదర్శన · నమూనా ధరలు: 1 L ₹450, 2 L ₹900, 5 L ₹2,250 · ఆర్డర్లు, చెల్లింపులు, డెలివరీ లేవు")}</div>;
}
