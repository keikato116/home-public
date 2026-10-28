// App Store Connect の「プライバシーポリシー URL」と、Google の OAuth 審査に出す URL。
//
// 内容はこのアプリが実際に行っている処理に合わせてある。機能を足したら必ず更新すること。
// とくに次を変えたら、ここも直さないと申告と実装がずれる:
//   ・外部サービスへの送信（現在: Supabase / Google / Anthropic / OpenWeatherMap / RevenueCat）
//   ・課金の内容（価格・対象機能）を変えたとき
//   ・新しい種類のデータを保存するとき
//
// 「Google ユーザーデータの取り扱い」の節は、sensitive scope（calendar.readonly）の
// 審査で必ず見られる。Limited Use に言及していないと差し戻される。

export const metadata = {
  title: "プライバシーポリシー | Imbrex",
};

const UPDATED = "2026年10月28日";

export default function PrivacyPage() {
  return (
    <main className="max-w-xl mx-auto px-7 py-12 space-y-8">
      <div>
        <h1 className="text-[22px] tracking-wide">プライバシーポリシー</h1>
        <p className="text-[11px] text-muted-foreground mt-1">最終更新日: {UPDATED}</p>
        <p className="mt-2">
          <a href="/privacy/en" className="text-[11px] underline underline-offset-4 text-muted-foreground hover:text-foreground">
            English
          </a>
        </p>
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
          <li>・アプリ内で入力・保存した内容（やること、家事の予定と実施記録、買い物リスト、レシピとその写真、献立、精算の記録）</li>
          <li>・Google カレンダーの予定（読み取りのみ。お客様が連携を許可した場合）</li>
          <li>・おおよその位置情報（緯度経度。天気の表示にのみ使用します）</li>
          <li>・有料プランの購入状態（加入の有無、購入した商品、有効期限）</li>
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
            ・<strong>RevenueCat</strong> — 有料プランの購入状態の管理。
            アプリ内の利用者ID（ランダムな識別子）と、購入した商品・有効期限が送信されます。
            氏名やメールアドレスは送信しません
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
          レシピに添付した写真は、非公開のストレージに保存されます。
          <strong>見られるのは、登録したご本人と、同じ世帯で使っている間のお相手だけです。</strong>
          表示のたびに1時間で失効する URL を発行するため、URL が他人に渡っても、
          期限が切れれば見られなくなります。
          URL から取り込んだレシピについては、取り込み先のサイトの画像を保存しません。
          表示を速くするため、一度表示した写真はお使いの端末に保存し、次からはそこから表示します。
          端末に保存した写真は、ログアウトやアカウントの削除で消え、一覧に出なくなった写真も順次消えます。
          写真は、アカウントを削除すると併せて削除されます。
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
          有料プランの決済は Apple が行います。<strong>クレジットカード番号などの支払い情報を、
          本アプリが取得することはありません。</strong>
          本アプリが受け取るのは、加入しているかどうか・購入した商品・有効期限といった購入状態だけで、
          有料機能を使えるかどうかの判定にのみ使います。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] tracking-wide">データの保護</h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          お客様の情報、とくに Google カレンダーへのアクセスに用いる認証情報を保護するため、
          次の措置を講じています。
        </p>
        <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <li>
            ・<strong>通信の暗号化</strong> — 端末とサーバーの間の通信はすべて TLS（HTTPS）で暗号化されます。
            本アプリのドメインは HSTS プリロードに登録されており、暗号化されない通信は行えません。
          </li>
          <li>
            ・<strong>認証情報の暗号化保存</strong> — Google の認証トークンは AES-256-GCM で暗号化して保存します。
            復号の鍵はデータベースの外に保管しており、データベースの内容だけが流出しても復号できません。
          </li>
          <li>
            ・<strong>カレンダーの予定を保存しない</strong> — 予定は表示のつど Google から取得します。
            当方のデータベースには保存せず、表示中の端末上にのみ保持されます。
          </li>
          <li>
            ・<strong>アクセス制御</strong> — データベースは行単位のアクセス制御（Row Level Security）により、
            各データをその所有者と、同じ世帯の方のみが参照できるよう制限しています。
            認証トークンは例外で、<strong>本人以外は同じ世帯の方であっても参照できません</strong>。
          </li>
          <li>
            ・<strong>最小限の権限</strong> — カレンダーについては読み取り専用の権限
            （<code className="text-[11px]">calendar.readonly</code>）のみを要求します。
            予定の作成・変更・削除を行う権限は要求しません。
          </li>
        </ul>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          データの保管には Supabase を、アプリの配信には Vercel を利用しており、
          各事業者のセキュリティ対策が適用されます。
          カレンダーの連携は、Google アカウントの
          「サードパーティ製アプリとの連携」からいつでも解除できます。
          解除すると、本アプリからカレンダーを参照できなくなります。
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
          ご不明な点は imbrex2026@gmail.com までご連絡ください。
        </p>
      </section>
    </main>
  );
}
