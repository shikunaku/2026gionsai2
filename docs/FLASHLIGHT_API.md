# 専用アプリ (Android WebView Bridge) フラッシュライト連携 API 仕様書

本プロジェクトの参加者用PDA端末（`/client`）では、Android WebView アプリとシームレスに連携し、ハードウェアLED（背面フラッシュライト / トーチ）をゼロ遅延で点灯・消灯・点滅制御するための JavaScript ブリッジを標準実装しています。

---

## 1. ネイティブ Bridge インターフェース一覧

専用アプリ（WebViewコンテナ）の Java / Kotlin 側で `@JavascriptInterface` として `window.Android` に登録するメソッド仕様です。

| メソッド | 引数 | 概要 | 推奨ユースケース |
| :--- | :--- | :--- | :--- |
| `Android.blink(count, intervalMs)` | `int count, int intervalMs` | 指定回数・間隔でネイティブ一括点滅 | 高速点滅・緊急警報 |
| `Android.blinkPattern(pattern, intervalMs)` | `String pattern, int intervalMs` | パターン文字列に沿ったリズム点滅 | 怪異調の「ぴかっ…ぴかっ…」など |
| `Android.stopBlink()` | なし | 実行中の点滅ループを即座に強制中断 | 管理者からの強制消灯時など |
| `Android.turnOnFlash()` | なし | フラッシュを常時点灯 | 常時点灯・非常照明 |
| `Android.turnOffFlash()` | なし | フラッシュを消灯 | 消灯時 |
| `Android.toggleFlash()` | なし | フラッシュのON/OFF状態を反転 | 旧バージョン向けフォールバック |
| `Android.isFlashOn()` | なし (戻り値: boolean) | 現在点灯しているかを判定 | カメラ復帰後の監視・保証 |

※ 互換性のため、`window.AndroidBridge`, `window.FlashlightBridge`, `window.TorchBridge`、および `turnOnTorch()` / `turnOffTorch()` / `setTorch(boolean)` 等の呼称でも自動認識されます。

---

## 2. API 呼び出し仕様 & パラメータ詳細

### ① 指定回数・間隔での点滅: `Android.blink(count, intervalMs)`
JSスレッドでループを回すのではなく、アプリ側のバックグラウンド処理で直接カメラハードウェアを明滅させます。
```javascript
// 例: 100ms間隔で5回点滅
if (window.Android && typeof window.Android.blink === 'function') {
    window.Android.blink(5, 100);
}
```
* **おすすめ設定 (KYV41等)**:
  * `intervalMs` は **`80ms` 〜 `120ms`**（推奨: **`100ms`**）。ハードウェア応答性の限界に合致し、最も滑らかに動作します。

### ② 自由なリズムでの怪異点滅: `Android.blinkPattern(pattern, intervalMs)`
「点灯・消灯のタイミングを細かく制御したい」場合に利用します。
```javascript
// 例: 怪異調の「ぴかっ…ぴかっ…ぴかっ…」点滅
// 1=点灯, 0=消灯
if (window.Android && typeof window.Android.blinkPattern === 'function') {
    window.Android.blinkPattern("1,0,0,1,0,0,1,0,0,0", 120);
}

// "101010" や "true,false,true,false" 形式の文字列にも対応
```

### ③ 点滅の中断: `Android.stopBlink()`
点滅処理を途中で安全に停止したい場合に呼び出します。
```javascript
if (window.Android && typeof window.Android.stopBlink === 'function') {
    window.Android.stopBlink();
}
```

---

## 3. カメラ撮影後の「フラッシュ消灯」対策仕様

### 発生原因
スマートフォンでは、`<input type="file" capture="environment">` によりOS標準のカメラアプリが起動すると、**OS側がカメラおよびLEDフラッシュのハードウェア占有権を奪うため、Web側に戻った際にフラッシュが強制消灯**されます。

### 本システムでの多重自動復旧メカニズム (`src/hooks/useTorch.ts`)
Webクライアントでは以下の3段階の自動復旧ウォッチドッグを備えています：

1. **画面復帰イベント (`focus`, `visibilitychange`, `pageshow`)**:
   * カメラアプリから撮影を終えてブラウザに戻った瞬間を即座に検知し、直前の目標状態が ON であれば自動で再点灯コマンドを再発行。
2. **ハードウェア解放待ちディレイ復旧 (300ms)**:
   * 端末によってはカメラアプリ終了後、数十〜数百ミリ秒の間カメラリソースがロックされるため、復帰イベント直後だけでなく300ms後にも再適用を実施。
3. **定期ハートビート・ウォッチドッグ (1.5秒毎)**:
   * 端末の画面が表示されており、かつシステム上の目標状態が「点灯」である限り、**1.5秒ごとにフラッシュ状態を確認・再点灯コマンドを発行**し、意図しない消灯状態のまま放置されるのを防ぎます。

---

## 4. Webフロントエンド側の呼び出しコード参照
* フック本体: [`src/hooks/useTorch.ts`](file:///c:/works-LeX13/2026/2026gionsai2/src/hooks/useTorch.ts)
* Socket連携部: [`src/app/client/page.tsx`](file:///c:/works-LeX13/2026/2026gionsai2/src/app/client/page.tsx)
* 管理者操作盤: [`src/components/admin/EffectTriggerPanel.tsx`](file:///c:/works-LeX13/2026/2026gionsai2/src/components/admin/EffectTriggerPanel.tsx)
