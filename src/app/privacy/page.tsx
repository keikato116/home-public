// App Store Connect の「プライバシーポリシー URL」と、Google の OAuth 審査に出す URL。
//
// 内容はこのアプリが実際に行っている処理に合わせてある。機能を足したら必ず更新すること。
// とくに次を変えたら、ここも直さないと申告と実装がずれる:
//   ・外部サービスへの送信（現在: Supabase / Google / Anthropic / OpenWeatherMap）
//   ・NEXT_PUBLIC_BILLING_ENABLED を true にしたとき（購入情報の取得が始まる）
//   ・新しい種類のデータを保存するとき
//
// 「Google ユーザーデータの取り扱い」の節は、sensitive scope（calendar.readonly）の
// 審査で必ず見られる。Limited Use に言及していないと差し戻される。

export const metadata = {
  title: "プライバシーポリシー | Imbrex",
};

const UPDATED = "2026年9月12日";

export default function PrivacyPage() {
  return (
    <main className="max-w-xl mx-auto px-7 py-12 space-y-8">
      <div>
        <h1 className="text-[22px] tracking-wide">プライバシーポリシー</h1>
        <p className="text-[11px] text-muted-foreground mt-1">最終更新日: {UPDATED}</p>
      </div>

      <section className="space-y-2">
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本アプリ「Imbrex」（以下、本アプリ）は、2人または1人で家事や予定を共有するためのアプリです。
          本ポリシーは、本アプリが取得する情報と、その取り扱いについて定めます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">取得する情報</h2>
        <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <li>・アカウント情報（サインインに使用した Google または Apple のアカウントのメールアドレス、表示名）</li>
          <li>・アプリ内で入力・保存した内容（やること、家事の予定と実施記録、買い物リスト、レシピ、献立、精算の記録）</li>
          <li>・Google カレンダーの予定（読み取りのみ。お客様が連携を許可した場合）</li>
          <li>・おおよその位置情報（緯度経度。天気の表示にのみ使用します）</li>
        </ul>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          クレジットカード情報、連絡先、写真ライブラリ全体へのアクセスは行いません。
          広告識別子の取得や、広告目的の追跡も行いません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">利用目的</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          取得した情報は、本アプリの機能を提供するためにのみ利用します。
          広告配信、プロファイリング、第三者への販売・提供は行いません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">世帯内での共有</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          招待コードで同じ世帯に参加した方とは、その世帯のデータが共有されます。
          ただし、次のものは本人にしか表示されません。
        </p>
        <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <li>・自分専用として追加した買い物リストの項目</li>
        </ul>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          レシピは<strong>登録した本人のもの</strong>です。
          同じ世帯にいる間はおたがいのレシピが表示されますが、
          共有を解除すると、それぞれ自分が登録したものだけが残ります。
          相手のレシピが手元に残ることはありません。
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          また、精算の記録と共有の買い物リストは、<strong>現在いっしょに使っている期間の分だけ</strong>表示されます。
          1人に戻ったあとで別の方を招待した場合、それ以前の記録が新しい相手に表示されることはありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">外部サービスへの送信</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本アプリは、機能の提供のために次のサービスを利用します。
        </p>
        <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <li>
            ・<strong>Supabase</strong> — アカウントと、アプリ内に保存したすべてのデータの保管
          </li>
          <li>
            ・<strong>Google</strong> — サインイン、およびカレンダーの読み取り
          </li>
          <li>
            ・<strong>Anthropic</strong> — レシピの取り込み。
            URL または写真からレシピを取り込む機能を使ったときにかぎり、
            <strong>取り込み先のページの内容、または選択した写真</strong>が解析のために送信されます。
            使用しないかぎり送信は発生しません。
          </li>
          <li>
            ・<strong>OpenWeatherMap</strong> — 天気の取得。
            ホーム画面を開いたときに<strong>緯度経度</strong>が送信されます。
            端末から位置情報を取得できない場合は、接続元から推定したおおよその位置を使用します。
          </li>
        </ul>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          各サービスにおける取り扱いは、それぞれの事業者のプライバシーポリシーに従います。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">Google ユーザーデータの取り扱い</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          本アプリが Google API から取得した情報の使用および他アプリへの転送は、
          限定的使用に関する要件（Limited Use）を含む
          <strong>Google API サービスのユーザーデータに関するポリシー</strong>に準拠します。
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          カレンダーの予定は、本アプリの画面に表示する目的にのみ使用します。
          広告への利用、第三者への販売、人による閲覧は行いません
          （法令上の要請、セキュリティ上の調査、またはお客様の明示的な同意がある場合を除きます）。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">写真について</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          レシピに添付した写真は Supabase のストレージに保存され、
          <strong>URL を知っている場合に閲覧できる形式</strong>で配信されます。
          URL は推測が困難なものが自動で割り当てられますが、
          第三者に知られたくない画像の登録はお控えください。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">通知について</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          家事のお知らせは、端末内で予定して端末が表示するものです。
          通知のために外部へ情報を送信することはなく、端末を識別する情報も保存しません。
          通知の可否と時刻は、アプリの設定画面からいつでも変更できます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">お支払い情報</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          現在、本アプリは有料の機能を提供していません。お支払いに関する情報は取得しません。
          今後、有料の機能を提供する場合は、本ポリシーを更新したうえでお知らせします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">データの削除</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          アプリの「設定 → アカウントを削除」から、アカウントと保存データを削除できます。
          世帯にもう1人いる場合は、共有していたデータを相手に引き継ぐかどうかを削除時に選べます。
          <strong>削除後の復元はできません。</strong>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">お問い合わせ</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          ご不明な点は support@imbrex.app までご連絡ください。
        </p>
      </section>
    </main>
  );
}
