"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { Recipe } from "@/types";

type RecipeInput = {
  title: string;
  ingredients: string;
  steps: string;
  cook_time_min?: number;
  servings?: number;
  category?: string;
  memo?: string;
};

const PRESET_RECIPES: RecipeInput[] = [
  {
    title: "魚の煮つけ",
    category: "魚料理",
    cook_time_min: 20,
    servings: 4,
    ingredients: `真鯛（あれば骨付き）… 4切れ（1切れ120g）
しょうが … 20g
A 酒 … 150ml
A 水 … 150ml
A しょうゆ … 大さじ3
A みりん … 大さじ2
A 砂糖 … 大さじ1
ししとう … 8本`,
    steps: `① 鍋に熱湯を沸かして火を止めて水を50mlほど入れて少し冷まします。真鯛を入れて1分霜降りし、表面の色が変わったら水に取り、ぬめりや血合い、汚れを指でそっとこすって取ります。キッチンペーパーで水気を優しく拭きます。
② しょうがの半量は皮を剥いて針しょうが（針のように細くせん切り）にして水に放します。残りは皮ごと薄切りにします。
③ フライパン又は平鍋にAを合わせて煮立て、魚と薄切りのしょうがを入れて紙の落としフタをして中火で8分間、時々煮汁をかけながら煮ます。
④ ③の落としフタを取り、軸を短く切ったししとうを入れて2分煮ます。
⑤ 器に④の魚とししとうを取り出し、煮汁を中強火で3分間煮詰めます。
⑥ ⑤の魚に煮詰めた煮汁をかけ、針しょうがを飾ります。`,
    memo: `★骨付きの切り身のほうが煮崩れしにくい
★魚は霜降りをしてから煮る（臭みを取るため。ぐらぐらと沸騰したところに入れると皮が剥がれるので、少し冷ましたところに入れる）
★煮る時は中火でサッと煮る（煮魚をふんわり煮えるには長く煮すぎないよう注意）
★魚を取り出してから煮汁を煮詰めてかけると甘辛くご飯に合う味つけになる`,
  },
  {
    title: "しらすと野菜の手作りふりかけ",
    category: "ご飯のお供",
    cook_time_min: 20,
    servings: 4,
    ingredients: `青菜の軸（ほうれん草・小松菜・大根の葉など）… 60g
塩 … 小さじ1/4
にんじん … 30g
しらす干し … 80g
油 … 小さじ1
A みりん … 小さじ2
A しょうゆ … 小さじ1
A 塩 … ひとつまみ
かつおパック … 1袋（3g）`,
    steps: `① 青菜の軸を小口切りにし、塩をふってもんで10分間置きます。
② ①がしなしなしたら、水気をしっかりと絞ります。
③ にんじんは短めのせん切りにします。
④ フライパンに③としらす、油を入れて中火で4〜6分間しらすがカリッとするまで焦げないように木べらで優しく混ぜながら炒めます。
⑤ ④に②を入れて更に4分間炒り、Aを入れて水分を飛ばして火を止め、かつおパックを混ぜます。`,
    memo: `白飯にのせて、おにぎりの具に、パスタに和えても美味しい。
パスタはゆでたらオリーブオイルとにらにして和える。`,
  },
  {
    title: "キャベツとささ身の和え物",
    category: "副菜",
    cook_time_min: 15,
    servings: 4,
    ingredients: `キャベツ … 360g
鶏のささ身 … 2本（140g）
酒 … 大さじ1
A 塩 … 小さじ1/4
A 砂糖 … 小さじ1/4
B ささ身の蒸し汁 … 大さじ1
B しょうゆ … 大さじ1
B 砂糖 … 小さじ1/4
B 白いりごま … 適量`,
    steps: `① キャベツの葉は3〜4cm角、芯の部分は薄切りにします。
② ①を耐熱ボウルに入れて軽くラップをし、500wの電子レンジで3分間かけ、一度混ぜて2〜3分間しんなりするまで加熱します。※茹でても良いです。
③ ②の粗熱が取れたら水気を軽く絞ります。
④ ささ身は耐熱容器に入れてAをまぶし、軽くラップをして500wの電子レンジで3分間かけ、ささ身を裏返して2分間かけます。中を割いて赤ければ+1分加熱してそのまま冷まして粗熱を取ります。
⑤ ④のささ身を裂き、③とBで和えて器に盛ります。`,
    memo: "",
  },
  {
    title: "エビマヨ",
    category: "中華",
    cook_time_min: 20,
    servings: 4,
    ingredients: `むきエビ … 300g（殻付きは330〜350gくらい）
A 塩 … 小さじ1/2
A 酒 … 大さじ1
A 片栗粉 … 大さじ1
B 塩 … 小さじ1/6
B 卵白 … 1コ分
B 片栗粉 … 大さじ4〜5
揚げ油 … 適宜
C マヨネーズ … 大さじ4
C ケチャップ … 大さじ1
C レモン汁 … 小さじ1/3
レタス … 2〜3枚`,
    steps: `① エビは背を軽く開いて背ワタを取り、Aでもみ洗いをして独特なニオイを取ります。
② ①にBをまぶします。
③ 油で②を揚げ焼きします。
④ ボウルにCを混ぜ、③が熱い内に和えます。
⑤ レタスを食べやすい大きさにちぎって器に敷き、④を盛ります。`,
    memo: "",
  },
  {
    title: "ワンタンスープ",
    category: "中華・スープ",
    cook_time_min: 30,
    servings: 4,
    ingredients: `A 豚ひき肉 … 180g
A 白ねぎ（みじん切り）… 20g
A しょうが（しぼり汁）… 小さじ1/2
A ごま油 … 小さじ1
A しょうゆ … 小さじ1/2
A 片栗粉 … 小さじ2
A 白こしょう … 少々
ワンタンの皮 … 24枚
ほうれん草 … 1束（80g）
スープ（★）… 1000ml（2人分は600ml）
B 酒 … 大さじ1
B しょうゆ … 大さじ1・1/2
B 塩 … 小さじ1/4
B 白こしょう … 少々

★スープの作り方：水1.2ℓ・鶏ガラスープの素 小さじ1、ねぎ（青い部分）適量・しょうがの皮 適量を鍋に入れて煮立て、沸騰したら中火で10分間ほど煮ます。`,
    steps: `① ボウルにAを混ぜ合わせ、ワンタンの皮で三角に折り、右と左の角をくっつけるように包みます。
② ほうれん草は軸を切り、3cm長さに切ってキレイに洗います。
③ 鍋にBとスープを入れて煮立てて①のワンタンを入れて3分間煮て、②のほうれん草を加えて2分間煮ます。※強火で煮るとワンタンが崩れるので注意します。`,
    memo: `冷凍して3週間くらいOK。
豚ひき肉の代わりにあいびき肉や鶏ひき肉でも可。`,
  },
  {
    title: "白菜とツナの中華和え",
    category: "中華・副菜",
    cook_time_min: 20,
    servings: 4,
    ingredients: `白菜 … 1/8株（240g）※きゅうりでも使用可
塩 … 小さじ1/4
ツナ（水煮）… 1缶（70g）
塩昆布（せん切りタイプ）… 適量
A ごま油 … 適量
A しょうゆ … 適量
A 酢 … 小さじ1/2`,
    steps: `① 白菜はせん切りにし、分量の塩をふってもみ込んでから10分間置いて水気を絞ります。
② ①とツナ、塩昆布、Aを合わせて和え、器に盛ります。`,
    memo: `野菜は塩もみにして千切りでじゃきじゃきした食感に。`,
  },
  {
    title: "からすみのパスタ",
    category: "パスタ・イタリアン",
    cook_time_min: 25,
    servings: 4,
    ingredients: `にんにく … 1かけ（10g）
赤唐辛子（乾燥）… 2本
オリーブ油 … 大さじ3
スパゲッティ … 320g
スパゲッティの茹で汁 … 120〜150ml
ボッタルガパウダー（からすみ）… 小さじ4（8g）
塩 … ふたつまみ
イタリアンパセリ … 4枝
オリーブ油（仕上げ用）… 小さじ2
ボッタルガパウダー（仕上げ用）… 小さじ2`,
    steps: `① にんにくは皮を剥いてみじん切り、赤唐辛子は種を取ります。
② フライパンに①と油を入れて弱火でじんわりと良い香りがするまで炒めます。
③ 鍋にたっぷりの湯を沸騰させ、塩（湯1ℓに対して塩10g）とスパゲッティを入れ、袋の表示時間よりマイナス1分茹でます。※茹で汁は後で使用します。
④ ②に分量のスパゲッティの茹で汁とスパゲッティを入れて加熱し、煮汁が乳化したら火を止め、ボッタルガパウダーを混ぜ、味を見て塩と刻んだイタリアンパセリ、仕上げの油を加えます。
⑤ 器に④を盛り、ボッタルガパウダーをふります。`,
    memo: `ペペロンチーノベースなので焦がしてもOK。
パスタ茹でる間ににんにくが焦げそうになったら先に茹で汁（100mlくらい）を入れて焦げるのをとめる。`,
  },
  {
    title: "シュリンプカクテル",
    category: "前菜・洋食",
    cook_time_min: 20,
    servings: 4,
    ingredients: `エビ（殻付き）… 12尾（240g）
A 白ワイン … 大さじ2
A 塩 … 小さじ1/4
A くず野菜（玉ねぎ・パセリの軸・レモン）… 適量
B トマトケチャップ … 大さじ4
B レモン汁 … 小さじ2
B ホースラディッシュ … 小さじ1〜1・1/2
B ウスターソース … 小さじ1
レモン（スライス）… 適量
イタリアンパセリ … 2枝`,
    steps: `① エビは殻付きのまま背ワタを取って、塩小さじ1/2とワイン大さじ1でもみ洗いします。
② 熱湯にAを入れて3分間茹で、氷水に取ります。
③ 冷えたら尾を残して殻を剥きます。
④ Bを混ぜ合わせてソースを作ります。
⑤ レモンは半分に切り、切り込みを入れます。
⑥ グラスに④のソースを入れ、グラスのふちにエビとレモン、イタリアンパセリを飾ります。`,
    memo: `殻から肉にかけて食べる。パーティーやおもてなしに。`,
  },
  {
    title: "彩野菜のクリスマスアスピック（ゼリー寄せ）",
    category: "前菜・洋食",
    servings: 4,
    ingredients: `【ブイヨン】
水 … 適量
白ワイン … 適量
玉ねぎ（繊維をたつように3mmの薄切り）… 20g
にんじんのへタや皮 … 10g
ローリエ … 1枚
板ゼラチン … 適量
彩野菜（にんじん・ブロッコリー・ミニトマトなど）… 適量`,
    steps: `① 鍋にブイヨンの材料を合わせて強火にかけ、アクを取りながら弱火で煮ます。
② 板ゼラチンは氷水に10分間浸けて戻します。
③ 鍋にAを合わせて火にかけ、煮立ったら火を止めて絞った②を入れて溶かします。鍋ごと氷水に浮かべて冷やしとろみをつけます。
④ 型（180mlカップ）に彩野菜を飾り、③を流し込んで冷蔵庫で固めます。`,
    memo: `プラスチックカップやグラスカップでも可。クリスマスの前日に作っておくと当日楽。`,
  },
];

interface RecipeState {
  recipes: Recipe[];
  loading: boolean;
  loadingPreset: boolean;
  load: (householdId: string) => Promise<void>;
  loadPreset: (householdId: string, userId: string) => Promise<void>;
  addByUrl: (householdId: string, url: string, userId: string) => Promise<void>;
  addByPhoto: (householdId: string, file: File, title: string, userId: string) => Promise<void>;
  addManual: (householdId: string, title: string, ingredients: string, steps: string, userId: string) => Promise<void>;
  deleteRecipe: (id: string, photoPath: string | null) => Promise<void>;
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  loading: false,
  loadingPreset: false,

  load: async (householdId) => {
    set({ loading: true });
    const supabase = createClient();
    const { data } = await supabase
      .from("recipes")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    set({ recipes: (data ?? []) as Recipe[], loading: false });
  },

  loadPreset: async (householdId, userId) => {
    set({ loadingPreset: true });
    const supabase = createClient();
    const existing = get().recipes.map(r => r.title);
    for (const recipe of PRESET_RECIPES) {
      if (existing.includes(recipe.title)) continue;
      const { data } = await supabase
        .from("recipes")
        .insert({
          household_id: householdId,
          title: recipe.title,
          source_type: "manual",
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          cook_time_min: recipe.cook_time_min ?? null,
          servings: recipe.servings ?? null,
          category: recipe.category ?? null,
          memo: recipe.memo || null,
          created_by: userId,
        })
        .select()
        .single();
      if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
    }
    set({ loadingPreset: false });
  },

  addByUrl: async (householdId, url, userId) => {
    const ogRes = await fetch("/api/recipe/og", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const { title, thumbnail_url } = ogRes.ok ? await ogRes.json() : { title: url, thumbnail_url: null };

    const supabase = createClient();
    const { data } = await supabase
      .from("recipes")
      .insert({ household_id: householdId, title, source_type: "url", url, thumbnail_url, created_by: userId })
      .select()
      .single();
    if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
  },

  addByPhoto: async (householdId, file, title, userId) => {
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${householdId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("recipes").upload(path, file);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from("recipes").getPublicUrl(path);

    const { data } = await supabase
      .from("recipes")
      .insert({ household_id: householdId, title, source_type: "photo", photo_path: path, thumbnail_url: publicUrl, created_by: userId })
      .select()
      .single();
    if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
  },

  addManual: async (householdId, title, ingredients, steps, userId) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("recipes")
      .insert({ household_id: householdId, title, source_type: "manual", ingredients, steps, created_by: userId })
      .select()
      .single();
    if (data) set((s) => ({ recipes: [data as Recipe, ...s.recipes] }));
  },

  deleteRecipe: async (id, photoPath) => {
    const supabase = createClient();
    if (photoPath) {
      await supabase.storage.from("recipes").remove([photoPath]);
    }
    await supabase.from("recipes").delete().eq("id", id);
    set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) }));
  },
}));
