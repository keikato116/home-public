// App Store Connect の「プライバシーポリシー URL」と、購入画面からのリンク先。
// 内容はこのアプリが実際に行っている処理に合わせて書いてある。機能を足したら必ず更新すること。

export const metadata = {
  title: "プライバシーポリシー | home",
};

const UPDATED = "2026年9月11日";

export default function PrivacyPage() {
  return (
    <main className="max-w-xl mx-auto px-7 py-12 space-y-8">
      <div>
        <h1 className="text-[22px] tracking-wide">プライバシーポリシー</h1>
        <p className="text-[11px] text-muted-foreground mt-1">最終更新日: {UPDATED}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">取得する情報</h2>
        <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <li>・アカウント情報（Google アカウントのメールアドレス、表示名）</li>
          <li>・アプリ内で入力・保存した内容（やること、買い物リスト、レシピ、献立、精算記録、日記）</li>
          <li>・Google カレンダーの予定（閲覧のみ。お客様が連携を許可した場合）</li>
          <li>・購入情報（App Store のサブスクリプション状態。クレジットカード情報は取得しません）</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">利用目的</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          取得した情報は、アプリの機能を提供するためにのみ利用します。広告配信や、第三者への販売・提供は行いません。
          世帯に参加している方どうしでは、その世帯のデータが共有されます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">外部サービス</h2>
        <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <li>・Supabase — アカウントとアプリ内データの保存</li>
          <li>・Google — サインインおよびカレンダーの読み取り</li>
          <li>・Anthropic — レシピやレシートの読み取り（送信した画像・URL の内容が解析に使われます）</li>
          <li>・RevenueCat / Apple — サブスクリプションの購入と管理</li>
          <li>・OpenWeatherMap — 天気の取得</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">データの削除</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          アプリの「設定 → アカウントを削除」から、アカウントと保存データを削除できます。
          削除後の復元はできません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">お問い合わせ</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          ご不明な点は、App Store の連絡先メールアドレスまでご連絡ください。
        </p>
      </section>
    </main>
  );
}
