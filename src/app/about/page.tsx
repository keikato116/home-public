// 公開のアプリ紹介ページ。ログイン不要で読める。
//
// Google の OAuth 審査で「ホームページがログインの裏にある」として差し戻された
// ため作った。審査官はアプリ名・用途・要求する権限の理由を、ログインせずに
// 確認できる必要がある。同意画面の「アプリケーションのホームページ」にはこの
// URL を入れること（`/` はログイン画面なので不可）。
//
// App Store Connect の「マーケティング URL」としても使える。
//
// **同意画面のアプリ名とここの表記を一致させること。** 食い違うと差し戻される
// （実際に、同意画面が旧名 `Home` のままで指摘を受けた）。

export const metadata = {
  title: "Imbrex — 二人の暮らしを一枚に",
  description:
    "Imbrex は、2人で暮らす人のための家事・予定・買い物の共有アプリです。" +
    "Google カレンダーの予定を並べて見ながら、家事の分担と食事の計画を立てられます。",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[13px] tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

const FEATURES: [string, string][] = [
  ["予定", "2人の Google カレンダーを1つの画面に並べ、どちらがいつ空いているかを見られます。"],
  ["家事", "毎日・毎週・毎月の家事を登録し、どちらがやったかを記録します。時刻を決めて通知を受け取れます。"],
  ["買い物", "買うものを共有します。一方が入れたものが、もう一方の手元にも出ます。"],
  ["献立", "その日の昼と夜に何を食べるかを決めて共有します。"],
  ["割り勘", "立て替えを記録し、締め日ごとに精算額を出します。"],
];

export default function AboutPage() {
  return (
    <main className="max-w-xl mx-auto px-7 py-12 space-y-10">
      <header className="space-y-2">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">imbrex</p>
        <h1 className="text-[26px] tracking-wide">二人の暮らしを、一枚に。</h1>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Imbrex は、2人で暮らす人のためのアプリです。予定・家事・買い物・献立・割り勘を
          ひとつにまとめ、「どちらがいつ空いていて、何をやるか」を、聞かなくても分かるようにします。
        </p>
      </header>

      <Section title="できること">
        <dl className="space-y-3">
          {FEATURES.map(([name, desc]) => (
            <div key={name} className="space-y-0.5">
              <dt className="text-[12px]">{name}</dt>
              <dd className="text-[12px] text-muted-foreground leading-relaxed">{desc}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Google カレンダーの読み取りについて">
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          お互いの予定を並べて見るために、Google カレンダーの予定を
          <strong className="text-foreground">読み取り専用</strong>で取得します
          （<code className="text-[11px]">calendar.readonly</code>）。
          予定の作成・変更・削除は行いません。
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          取得した予定はアプリの画面に表示するためだけに使い、当社のデータベースには保存しません。
          広告や分析には使わず、第三者にも提供しません。
          連携はいつでも Google アカウントの設定から解除できます。
        </p>
      </Section>

      <Section title="料金">
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          無料で利用できます。アプリ内に広告はありません。
        </p>
      </Section>

      <Section title="提供">
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          お問い合わせ: imbrex2026@gmail.com
        </p>
      </Section>

      <nav className="flex gap-5 pt-2 border-t border-border">
        <a href="/" className="text-[11px] underline underline-offset-4 text-muted-foreground hover:text-foreground">
          アプリを開く
        </a>
        <a href="/privacy" className="text-[11px] underline underline-offset-4 text-muted-foreground hover:text-foreground">
          プライバシーポリシー
        </a>
        <a href="/terms" className="text-[11px] underline underline-offset-4 text-muted-foreground hover:text-foreground">
          利用規約
        </a>
      </nav>
    </main>
  );
}
