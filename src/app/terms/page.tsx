// App Store Connect の「利用規約（EULA）URL」と、Google の OAuth 審査に出す URL。
//
// Apple の標準 EULA を使う場合でも、サブスクリプションの条件はここに書いておく必要がある。
// NEXT_PUBLIC_BILLING_ENABLED を true にするときは「5. 有料プラン」を
// 提供中の内容に書き換えること。いまは提供していない前提で書いてある。

export const metadata = {
  title: "利用規約 | home",
};

const UPDATED = "2026年9月12日";

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
          本規約は、本アプリ「home」（以下、本アプリ）の利用条件を定めるものです。
          本アプリを利用された時点で、本規約に同意したものとみなします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">2. アカウント</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本アプリの利用には、Google アカウントまたは Apple アカウントでのサインインが必要です。
          アカウントの管理はお客様の責任で行ってください。
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本アプリは13歳未満の方の利用を想定していません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">3. 世帯の共有</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          招待コードを共有した相手とは、<strong>同じ世帯のデータが共有されます。</strong>
          共有したくない相手に招待コードを渡さないようご注意ください。
          共有される範囲は、プライバシーポリシーに記載しています。
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          1人で利用している間は、2人での利用を前提とする機能（精算）は表示されません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">4. 共有の解除</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          共有の解除（グループの解散）は、招待した側・された側のどちらからでも行えます。
          どちらが操作した場合でも、次のように扱われます。
        </p>
        <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <li>・世帯を作成した方が、これまでのデータをそのまま引き継ぎます。</li>
          <li>
            ・あとから参加した方は1人での利用に戻り、
            レシピ・家事の予定・やること・献立の<strong>複製</strong>を持って移ります。
          </li>
          <li>・本人だけに表示される買い物リストの項目は、それぞれの利用者に引き継がれます。</li>
          <li>
            ・精算の記録と共有の買い物リストは、世帯を作成した方に残ります。
            解散後に新しい方を招待しても、<strong>解散前の記録が新しい相手に表示されることはありません。</strong>
          </li>
          <li>・カレンダーの相互表示は、解散した時点で終了します。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">5. 有料プラン</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          現在、本アプリは有料の機能を提供していません。
          今後、有料の機能を提供する場合は、本規約を更新したうえで、
          料金・更新条件・解約方法を明示します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">6. 禁止事項</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          法令に違反する行為、本アプリの運営を妨げる行為、
          他の利用者や第三者の権利を侵害する行為を禁止します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">7. 免責</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本アプリは現状有姿で提供されます。
          天気やカレンダーなど外部サービスに由来する情報の正確性、
          および本アプリの利用によって生じた損害について、開発者は責任を負いかねます。
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          家事のお知らせは端末の状態によって表示されないことがあります。
          重要な予定の管理を本アプリの通知のみに依存しないでください。
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          また、事前の予告なく機能の変更・停止を行う場合があります。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">8. 規約の変更</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本規約は必要に応じて変更することがあります。
          変更後の規約は、本ページに掲載した時点から適用されます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">9. 準拠法</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本規約は日本法に準拠し、本アプリに関して生じた紛争については、
          開発者の所在地を管轄する日本の裁判所を専属的合意管轄とします。
        </p>
      </section>
    </main>
  );
}
