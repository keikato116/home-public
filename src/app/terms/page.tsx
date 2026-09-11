// App Store Connect の「利用規約（EULA）URL」と、購入画面からのリンク先。
// Apple の標準 EULA を使う場合でも、サブスクリプションの条件はここに書いておく必要がある。

export const metadata = {
  title: "利用規約 | home",
};

const UPDATED = "2026年9月11日";

export default function TermsPage() {
  return (
    <main className="max-w-xl mx-auto px-7 py-12 space-y-8">
      <div>
        <h1 className="text-[22px] tracking-wide">利用規約</h1>
        <p className="text-[11px] text-muted-foreground mt-1">最終更新日: {UPDATED}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">1. 本規約について</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本規約は、本アプリ「home」の利用条件を定めるものです。本アプリを利用された時点で、本規約に同意したものとみなします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">2. アカウント</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本アプリの利用には Google アカウントでのサインインが必要です。招待コードを共有した相手とは、
          同じ世帯のデータがすべて共有されます。共有したくない相手に招待コードを渡さないようご注意ください。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">3. 有料プラン</h2>
        <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <li>・有料プランに加入すると、レシピ機能と献立カレンダーが利用できます。</li>
          <li>・料金は購入確定時に Apple ID に請求されます。</li>
          <li>・期間終了の 24 時間前までに自動更新をオフにしない限り、同額で自動更新されます。</li>
          <li>・解約は iPhone の「設定 → Apple ID → サブスクリプション」から行えます。アプリ内では解約できません。</li>
          <li>・返金は Apple の規定に従います。開発者側での返金対応はできません。</li>
          <li>・有料プランは世帯単位で有効になり、同じ世帯のメンバーも利用できます。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">4. 禁止事項</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          法令に違反する行為、本アプリの運営を妨げる行為、他の利用者や第三者の権利を侵害する行為を禁止します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">5. 免責</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本アプリは現状有姿で提供されます。天気やカレンダーなど外部サービスに由来する情報の正確性、
          および本アプリの利用によって生じた損害について、開発者は責任を負いかねます。
          また、事前の予告なく機能の変更・停止を行う場合があります。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">6. 規約の変更</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本規約は必要に応じて変更することがあります。変更後の規約は、本ページに掲載した時点から適用されます。
        </p>
      </section>
    </main>
  );
}
