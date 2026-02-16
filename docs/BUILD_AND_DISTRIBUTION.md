# Build and Distribution

This document describes the cross-platform build pipeline, how to fix common issues, and how to enable production-ready macOS distribution (code signing and notarization).

## What Was Fixed (Summary)

### 1. Windows and Linux build failures

- **Cause:** GitHub Actions sets `CI=true`. The Tauri CLI treats this as `--ci 1`, but it only accepts `--ci true` or `--ci false`. That led to: `error: invalid value '1' for '--ci'`.
- **Fix:** Set `CI: "false"` in the workflow `env` so `npm run tauri build` runs without an invalid `--ci` flag. Builds remain non-interactive.

### 2. macOS “App is damaged and can’t be opened”

- **Cause:** The app was either unsigned or ad-hoc signed. Gatekeeper blocks such apps when opened after download (e.g. from a DMG), and shows “damaged” when the app is not properly signed and notarized.
- **Fix:**
  - **Code signing:** Use a **Developer ID Application** certificate. In CI, the workflow imports the certificate from secrets and sets `APPLE_SIGNING_IDENTITY` so Tauri signs the app and DMG.
  - **Notarization:** Set `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), and `APPLE_TEAM_ID`. Tauri submits the app to Apple for notarization and staples the ticket so Gatekeeper accepts it.
  - **Entitlements:** `src-tauri/entitlements.mac.plist` is configured in `tauri.conf.json` so the signed app has the correct hardened runtime entitlements.

### 3. Windows MSI / WiX failure (CI)

- **Cause:** With `bundle.targets: "all"`, Tauri builds both MSI (WiX) and NSIS on Windows. MSI requires downloading WiX (`wix314-binaries.zip`); the download often fails in CI with HTTP 500 from GitHub/CDN.
- **Fix:** In CI we build only the NSIS bundle on Windows (`tauri build --bundles nsis`), so WiX is never downloaded. The Windows artifact is the NSIS installer (`.exe`). Local Windows builds can still run `tauri build` without `--bundles nsis` to produce MSI too if WiX is available.

### 4. Linux AppImage / AppRun failure (CI)

- **Cause:** With `bundle.targets: "all"`, Tauri builds DEB, RPM, and AppImage on Linux. AppImage requires downloading AppRun (e.g. `AppRun-x86_64`) from `tauri-apps/binary-releases`; that download often fails in CI with HTTP 500.
- **Fix:** In CI we build only DEB and RPM on Linux (`tauri build --bundles deb,rpm`), so the AppRun/AppImage download is never triggered. The Linux artifact is `.deb` and `.rpm` only. Local Linux builds can still run `tauri build` without `--bundles deb,rpm` to produce AppImage too when the download succeeds.

### 5. Artifact paths and packaging

- **Linux (CI):** `src-tauri/target/release/bundle/deb/*.deb` and `src-tauri/target/release/bundle/rpm/*.rpm`. No AppImage in CI to avoid AppRun download.
- **Windows (CI):** Only `src-tauri/target/release/bundle/nsis/*.exe` (NSIS installer). No MSI in CI to avoid WiX download.
- **macOS:** `src-tauri/target/release/bundle/dmg/*.dmg` and `src-tauri/target/release/bundle/macos/*.app` are uploaded. The DMG is the main distributable; the .app is also available for verification.

### 6. Verification steps (build workflow)

- On macOS, after build we run:
  - `codesign -dv --verbose=2` and `codesign --verify --deep --strict` on the .app to confirm it is correctly signed.
  - `xcrun stapler validate` on the .app when notarization credentials were used (optional; may be no-op if not notarized).

---

## Enabling macOS code signing and notarization

To produce a macOS build that opens without “damaged” or Gatekeeper warnings:

1. **Apple Developer account**  
   You need a paid Apple Developer account (or a free account for local testing only; notarization requires a paid account).

2. **Developer ID Application certificate**  
   - In [Certificates, IDs & Profiles](https://developer.apple.com/account/resources/certificates/list), create a **Developer ID Application** certificate (Account Holder only).  
   - Download the `.cer`, open it to add to Keychain.  
   - In Keychain Access → My Certificates, expand the certificate, right‑click the **private key** → **Export** → save as `.p12` and set a password.  
   - Encode for CI:
     ```bash
     openssl base64 -A -in /path/to/certificate.p12 -out certificate-base64.txt
     ```
   - Add the contents of `certificate-base64.txt` as repository secret **`APPLE_CERTIFICATE`**, and the .p12 password as **`APPLE_CERTIFICATE_PASSWORD`**.

3. **Notarization credentials**  
   - **Apple ID:** Your Apple ID email → secret **`APPLE_ID`**.  
   - **App-specific password:** [Create an app-specific password](https://support.apple.com/en-ca/HT204397) → secret **`APPLE_PASSWORD`**.  
   - **Team ID:** [Membership details](https://developer.apple.com/account#MembershipDetailsCard) → secret **`APPLE_TEAM_ID`**.

4. **Keychain password (CI only)**  
   The workflow creates a temporary keychain to import the certificate. Set a random password as repository secret **`KEYCHAIN_PASSWORD`** (e.g. `openssl rand -base64 32`).

5. **Turn on signing in CI**  
   In the repo: **Settings → Secrets and variables → Actions → Variables** (not Secrets), add:
   - Name: **`ENABLE_MACOS_SIGNING`**  
   - Value: **`true`**  

   When `ENABLE_MACOS_SIGNING` is `true` and the Apple secrets above are set, the **Multi-Platform Build** and **Build and Release** workflows will import the certificate, sign the app, and notarize it (and staple when supported).

---

## Getting the Windows .exe

The Windows build runs only on Windows (e.g. in GitHub Actions). You cannot produce a real Windows `.exe` when building on macOS.

**Option 1 – GitHub Actions (recommended from macOS)**

1. **Windows-only build:** In the repo go to **Actions → Build Windows**. Click **Run workflow**, choose the branch (e.g. `master`), then **Run workflow**. When the job finishes, open the run and download the **projectfile-pro-windows** artifact (contains the NSIS `.exe` installer).
2. **Full CI:** Push to `master` or open a PR. The **CI Build** workflow runs on Windows and uploads the same **projectfile-pro-windows** artifact; download it from the completed run.

**Option 2 – Build on a Windows machine**

On a Windows PC with Node.js and Rust installed, in the project root (`file-pro/`):

```bash
npm ci
npm run build
npm run tauri build -- --bundles nsis
```

The installer will be at: `src-tauri/target/release/bundle/nsis/*.exe`. A standalone executable (no installer) is also produced in `src-tauri/target/release/` (e.g. `projectfile-pro.exe`).

---

## Workflows

| Workflow           | Trigger              | Purpose                                                                 |
|-------------------|----------------------|-------------------------------------------------------------------------|
| **build.yml**     | Push to `master`, or manual | Build on macOS, Linux, Windows; upload artifacts; optional macOS sign/notarize and verification. |
| **build-windows.yml** | Manual only       | Build only the Windows NSIS `.exe`; upload **projectfile-pro-windows** artifact. |
| **release.yml**  | Push tag `v*`, or manual with tag input | Build and attach installers to the GitHub Release for that tag.        |

- **build.yml** uses a matrix: `macos-latest`, `ubuntu-latest`, `windows-latest`. Each job runs `npm ci` and `npm run tauri build`, then uploads OS-specific artifacts.  
- **release.yml** uses the same matrix and **tauri-action** to build and upload release assets. Both workflows use `CI: "false"` and the same optional macOS signing flow when `ENABLE_MACOS_SIGNING` and Apple secrets are set.

---

## Local verification (macOS)

After building locally or downloading the macOS artifact:

```bash
# Replace with your .app path
APP_PATH="src-tauri/target/release/bundle/macos/projectfile-pro.app"

# Code signature
codesign -dv --verbose=2 "$APP_PATH"
codesign --verify --deep --strict "$APP_PATH"

# Notarization staple (if notarized)
xcrun stapler validate "$APP_PATH"
```

---

## Platform notes

- **macOS:** Signing and notarization are required for distribution without “damaged” or Gatekeeper dialogs. Do not rely on `xattr -cr` or “Open Anyway”; use proper Developer ID signing and notarization.  
- **Windows:** In CI only the NSIS installer (`.exe`) is produced so the build does not depend on WiX download. MSI (WiX) is skipped in CI; local builds can still produce MSI with `tauri build` (no `--bundles nsis`). No code signing is configured; add certificate and `signCommand` in `tauri.conf.json` if you need signed Windows installers.  
- **Linux:** In CI only DEB and RPM are produced so the build does not depend on the AppRun/AppImage download from tauri-apps/binary-releases. AppImage is skipped in CI; local builds can still produce it with `tauri build` (no `--bundles deb,rpm`). System deps (e.g. `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`) are installed in the workflow; see `build.yml` for the full list.
