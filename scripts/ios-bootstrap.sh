#!/usr/bin/env bash
# ios/ を作り直す。
#
# ios/ は生成物なので、壊したら消して作り直してよい。ただし `cap add ios` が
# 作るのは素の雛形で、このアプリが必要とする設定は入らない。手で入れ直すと
# 必ずどれか忘れる（実際、名前を2か所直し忘れて ITMS-90129 を踏んだ）ので、
# 必要なものをここに全部書いてある。
#
#   ./scripts/ios-bootstrap.sh          作り直す
#   ./scripts/ios-bootstrap.sh --build 5   ビルド番号も指定する
#
# 実行後、Xcode 側で手作業が2つだけ残る（下に出力される）。
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD_NUMBER=4
if [ "${1:-}" = "--build" ]; then BUILD_NUMBER="${2:?--build には番号が要る}"; fi

PLIST=ios/App/App/Info.plist
PBXPROJ=ios/App/App.xcodeproj/project.pbxproj
SCHEME=com.keikato.homeapp   # NATIVE_AUTH_REDIRECT と一致させること

if [ ! -f .env.local ] || ! grep -q '^CAP_SERVER_URL=' .env.local; then
  echo "✗ .env.local に CAP_SERVER_URL がない。capacitor.config.ts がこれを読む。" >&2
  exit 1
fi

if [ -d ios ]; then
  echo "ios/ を削除します。生成物なので中身は失われても構わないもののみ。"
  read -r -p "続けますか? [y/N] " ans
  [ "$ans" = "y" ] || { echo "中止"; exit 1; }
  rm -rf ios
fi

echo "▸ npm install"
npm install

echo "▸ next build（webDir の中身ではなく、型とビルドの健全性の確認）"
npm run build

echo "▸ cap add ios"
npx cap add ios

echo "▸ cap sync ios"
npx cap sync ios

# アイコンと entitlements は git が持っているので取り戻す
echo "▸ git 管理下の iOS ファイルを復元"
git checkout -- ios/App/App/Assets.xcassets ios/App/App/App.entitlements 2>/dev/null || true

echo "▸ Info.plist"
plist() { /usr/libexec/PlistBuddy -c "$1" "$PLIST"; }
set_or_add() { # key type value
  plist "Set :$1 $3" 2>/dev/null || plist "Add :$1 $2 $3"
}

# アプリ名。CFBundleName は既定で $(PRODUCT_NAME)=App に展開され、
# CFBundleDisplayName は capacitor.config.ts の appName になる。どちらも
# App Store 全体で一意でないと ITMS-90129 で弾かれるので、両方入れる。
set_or_add CFBundleName string Imbrex
set_or_add CFBundleDisplayName string Imbrex

# WebView から Safari に出した Google ログインが戻ってくる先
plist "Delete :CFBundleURLTypes" 2>/dev/null || true
plist "Add :CFBundleURLTypes array"
plist "Add :CFBundleURLTypes:0 dict"
plist "Add :CFBundleURLTypes:0:CFBundleTypeRole string Editor"
plist "Add :CFBundleURLTypes:0:CFBundleURLName string $SCHEME"
plist "Add :CFBundleURLTypes:0:CFBundleURLSchemes array"
plist "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $SCHEME"

# HTTPS しか使わないので輸出コンプライアンスは免除。入れておくと
# アップロードのたびに質問されなくなる。
set_or_add ITSAppUsesNonExemptEncryption bool false

# レシピ写真の <input type="file" accept="image/*">。カメラの説明が無いと
# 「写真を撮る」を選んだ瞬間に iOS がアプリを落とす。
set_or_add NSCameraUsageDescription string レシピの写真を撮影するために使用します
set_or_add NSPhotoLibraryUsageDescription string レシピの写真を選ぶために使用します

echo "▸ ビルド番号 → $BUILD_NUMBER"
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" "$PBXPROJ"

echo
echo "── 確認 ──"
plist "Print :CFBundleName"
plist "Print :CFBundleDisplayName"
plist "Print :CFBundleIdentifier"
plist "Print :CFBundleURLTypes:0:CFBundleURLSchemes:0"
plist "Print :ITSAppUsesNonExemptEncryption"
grep -c "CURRENT_PROJECT_VERSION = $BUILD_NUMBER;" "$PBXPROJ" | sed 's/^/CURRENT_PROJECT_VERSION の行数: /'
grep -q LocalNotifications ios/App/CapApp-SPM/Package.swift \
  && echo "LocalNotifications: SPM に登録あり" \
  || echo "LocalNotifications: ✗ SPM に無い"
plutil -lint "$PLIST"

cat <<'NEXT'

── Xcode で手作業が2つ残ります ──
  1. App ターゲット → Signing & Capabilities → Team を選ぶ
     （(Personal Team) が付かないほう）
  2. + Capability → Sign in with Apple
     App.entitlements は git から戻っているが、CODE_SIGN_ENTITLEMENTS の
     紐付けは cap add が作らないので、ここで付け直す必要がある

  Push Notifications は追加しないこと。ローカル通知に capability は不要で、
  aps-environment が付くと署名で落ちる経路が増えるだけ。

  そのあと Any iOS Device (arm64) → Product → Archive
NEXT
