import { useState, useCallback } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "up-to-date"
    | "downloading"
    | "ready"
    | "error";

export function useUpdate() {
    const [status, setStatus] = useState<UpdateStatus>("idle");
    const [update, setUpdate] = useState<Update | null>(null);
    const [progress, setProgress] = useState(0);
    const [contentLength, setContentLength] = useState(0);
    const [errorMsg, setErrorMsg] = useState("");

    const checkUpdates = useCallback(async (silent = false) => {
        try {
            setStatus("checking");
            setErrorMsg("");
            const result = await check();

            if (result) {
                setUpdate(result);
                setStatus("available");
                return result;
            } else {
                setStatus("up-to-date");
                // If silent (auto-check), we might want to go back to idle or stay up-to-date
                // For now, "up-to-date" lets the UI show "You are on the latest version"
                return null;
            }
        } catch (err) {
            console.warn("[useUpdate] Failed to check for updates:", err);
            // In silent mode, maybe we don't want to show error?
            // But for manual check, we do.
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setStatus("error");
            throw err;
        }
    }, []);

    const downloadAndInstall = useCallback(async () => {
        if (!update) return;

        try {
            setStatus("downloading");
            setProgress(0);

            let downloaded = 0;
            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case "Started":
                        setContentLength(event.data.contentLength ?? 0);
                        break;
                    case "Progress":
                        downloaded += event.data.chunkLength;
                        if (contentLength > 0) {
                            setProgress(Math.round((downloaded / contentLength) * 100));
                        }
                        break;
                    case "Finished":
                        setProgress(100);
                        break;
                }
            });

            setStatus("ready");
        } catch (err) {
            console.error("[useUpdate] Update install failed:", err);
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setStatus("error");
        }
    }, [update, contentLength]);

    const relaunchApp = useCallback(async () => {
        try {
            await relaunch();
        } catch (err) {
            console.error("[useUpdate] Relaunch failed:", err);
            setErrorMsg(err instanceof Error ? err.message : String(err));
        }
    }, []);

    const resetStatus = useCallback(() => {
        setStatus("idle");
        setUpdate(null);
        setErrorMsg("");
        setProgress(0);
    }, []);

    return {
        status,
        update,
        progress,
        errorMsg,
        checkUpdates,
        downloadAndInstall,
        relaunchApp,
        resetStatus,
    };
}
