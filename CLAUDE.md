# CLAUDE.md — 專案開發指南

> 給 Claude / 協作者:接手本專案前先讀這份。記錄了**從程式碼看不出來**的架構意圖、設計決策與驗證流程。

## 專案是什麼

「**約瑟的夢 — 十七歲的抉擇**」:以聖經創世記約瑟故事為基底、**為青少年設計**的網頁文字冒險遊戲。
單檔遊戲,**所有東西都在 `index.html`**(HTML + CSS + 內嵌 SVG + 原生 JS,無任何相依套件、無建置步驟)。

倉庫:https://github.com/windoll/josephdream (`main` 分支)

### 檔案結構
- `index.html` — 整個遊戲(樣式、插畫、引擎、劇情全在這)
- `og.png` / `apple-touch-icon.png` — 社群預覽圖與 iOS 圖示(用 PowerShell System.Drawing 產生,改文案時需重產)
- `README.md` — 給玩家/訪客看的公開說明(頂部有 GitHub Pages 遊玩連結)
- `CLAUDE.md` — 本檔
- `.gitignore` — 排除 `.claude/`(本地設定、launch.json 等不進倉庫)

線上版:https://windoll.github.io/josephdream/ (GitHub Pages 已開通,push main 後約 1–2 分鐘自動更新)

## 核心設計理念(最重要,別破壞)

這款遊戲的目標受眾是**青少年**,核心訴求是「**讓選擇真的有後果**」。歷經多次改版後的定案:

**主題層(2026-06 定案)**:遊戲同時承載三個牧養目標——①了解每個人都有原生家庭,影響我們對關係的想法(「父親的故事」場景:偏心與欺騙的三代傳承);②以溫和安全的方式讓青少年看見自己的家庭模式(固定討論題的「三段安全橋」:約瑟家→觀察到的模式→自己[可保留不說]);③從聖經觀點明白最終身份根源在神(「兩個名字」瑪拿西/以法蓮場景 + 各結局的「🌱 身份的根」)。改文案時別破壞這三條線。

1. **三屬性必須是「槓桿」而非「鏡子」** — 屬性不能只是默默累積、最後分類結局而已。它們要**在過程中實際影響可選項與走向**(門檻、取捨、風險)。任何改動都要維持這點。
2. **語氣 = 中間偏文學** — 青少年聽得懂、不老氣、但仍有質感與意象。別寫成太文言,也別太幼稚或太網路梗。
3. **聖經淡化為背景** — 保留 📖 標記、章節出處、結局反思,但**故事優先、降低說教感**。經文出處(`ref`)刻意做得小而淡。
4. **What-if 自由想像** — 允許「如果約瑟做了別的選擇」的分支;虛構場景與非聖經結局要**誠實標註**為「虛構支線 / What-if」,不掛真實章節。

## 遊戲引擎架構(都在 `index.html` 的 `<script>`)

### 資料模型
- `stats = {faith, wisdom, ambition}` — 三屬性,起始皆 `20`。內部鍵用英文,UI 顯示「信心/智慧/野心」。
  - **數值一律整十**(`+10` / `+20` / `−10`)。這是使用者明確要求,務必維持。
- `S` — 場景物件表。用 `scene(id, def)` 註冊。`e(faith,wisdom,ambition)` 是 eff 的簡寫。
- `ENDINGS` — 7 個結局物件,各有 `name / type(「型」標籤) / kind(good|neutral|bad) / reflect`;善果結局有 `epilogue`;`reconcile` 有 `canonical:true`;`egypt_lord` 有 `overrideText`(見下)。

### 一個 scene 物件可有的欄位
- `title, art(artSVG 的鍵), ref(經文出處), fiction(true 則 ref 顯示「✦ 虛構」樣式), text, verse`
- `ending:"<id>"` — 直接結局場景
- `dynamic:true` — 由 `pickDynamicEnding()` 依當下屬性決定結局(目前只有 `resolve`)
- `choices: [...]`,每個 choice 可有:
  - `text, next, eff`(可含負值 = 取捨)
  - `bible:true` — 顯示「📖 聖經」標籤(代表符合聖經記載)
  - `req: {stat, val}`(+選配 `lockedNote`) — **屬性門檻**。不符時顯示 🔒 鎖定按鈕(disabled),提示文字自動生成「需要野心 40,目前 30」+lockedNote。(舊版用 cond+lockedHint,已全面改為 req。)
  - `risk: {stat, bonus, success, fail, successEff, failEff}` + `tag` — **風險賭注**。`doChoice` 用機率 `p = clamp(stats[stat]+bonus, 10, 90)`,`Math.random()*100 < p` 決定成敗,各走 success/fail 場景、套各自 eff。⚠️ 改 risk 結構時記得同步改 `doChoice`(曾因只改資料沒改 handler 而出 bug)。目前 3 個賭點:dothan(賭智慧)、egypt(賭野心)、pharaoh(賭信心,且該選項同時是 📖)。
  - `flag:"name"` — 點選後設 `flags[name]=true`(隨存檔保存),供 callback 使用。

### Callback(讓遊戲記得早期選擇)
`CALLBACKS` 表(scene id → fn 回傳 `{pre,post}`),在 `go()` 渲染時把 pre/post 段落接到 `sc.text` 前後。目前:`grudge`(多坍記恨)→brothers 加一段;`forgave_direct`/`fled`→resolve 加開場句。**結局有 overrideText 時不套 callback。**新增 callback 時用 flags,別解析 journey 文字。

### 結局判定 `pickDynamicEnding()`(寬恕路線終局)
順序很重要,別隨意調:
1. `ambition>=60 && 野心嚴格最大` → `egypt_lord`(埃及的權臣)
2. `faith>=50 && wisdom>=50` → `reconcile`(飽足之地,canonical,**最圓滿**)
3. `faith>=60 && 信心嚴格最大` → `faith_crown`
4. `wisdom>=60 && 智慧嚴格最大` → `wise_savior`
5. 其餘 → `reconcile`

> **設計重點**:`reconcile` 要求信心+智慧雙高,所以「砍信心換野心」的取捨**會讓你失去最圓滿的結局**——這是取捨「有代價」的關鍵機制,別改回單純比大小。

### 主要場景流向
`start → dothan →`(賭智慧:`flee_wild` / `the_pit`,或直接 `the_pit`)`→ memory(父親的故事,主題①,雙路皆經過) → egypt →`(賭野心:`egypt_schemed` / `egypt_burned`,或直接)`→ temptation →`(逃離→`prison` / 智取[智≥40]→`outwit1→outwit2→prison` / 屈服→`end_fallen`)`→ prison → pharaoh →`(賭信心📖:成功→`sons` / 失敗→`pharaoh_doubt→sons`;或直接 `sons` / 婉拒→`end_shepherd`)`→ sons(兩個名字,主題③,創41:50–52) → vizier → brothers →`(直接寬恕[信≥50]→`resolve` / 試探→`test_brothers` / 報復→`revenge1`)。`test_brothers →`(相認→`resolve` / 報復→`revenge1`)。`resolve` 為 dynamic 終局。共 22 場景。

### 標題畫面與啟動流程
啟動一律呼叫 `showTitle()`(不在 `S` 裡,DFS 驗證不用管它):標題卡+玩法說明(📖/🎲/🔒),偵測到存檔顯示「繼續上次/從頭開始」。footer 有 ⌂ 封面鈕;「重新開始」走自製 confirm modal(`#confirmBg`),不用原生 confirm()。

### 結局頁區塊(順序固定)
結局標頭(name/type「你是【X型】的約瑟」/kind/canonical)→ 正文(`E.overrideText||text+callback`)→ `epilogue` → verse(有 overrideText 時抑制)→ `nearMissHTML`(差一點解鎖提示,取 gap 最小一條)→ `bibleLineHTML`(📖 X/Y 統計)→ reflect → `identity`(🌱 身份的根,主題③)→ `discHTML()`(摺疊式討論題+列印鈕)→ journey 回顧(含 ✦ 虛構標記與「本局行經」經文清單)。按鈕:分享(share→clipboard→execCommand 三層 fallback)/再玩/圖鑑。

### 討論題(固定一套,不分結局)——牧養安全規範
`DISC` 常數 5 題,結構是刻意的「三段安全橋」:第 1–2 題只談約瑟家(第三人稱)→ 第 3 題**第三方例子優先**(戲劇/電影/別人家;「想講自己家也可以,但完全不必」)→ 第 4 題完全私密(「在心裡想就好」+ 條件語「如果有的話」+「將來」)→ 第 5 題身份在神(瑪拿西引文**必須**帶重釋「忘了不是假裝沒發生,而是那些事不再替他做決定」;約1:12 保留「凡接待他的」條件語氣)。**改題目時必須保持這個梯度與保護措辭。**

經創傷知情審查後的固定防線(別刪):
- 帶領者註三行:全題可 pass / 第4題不點名不追問不書寫回收 / 揭露現行傷害的接應原則 + **「原諒不等於回到會繼續傷害你的關係裡」**(約瑟是在哥哥們真的改變後才相認——這層意義必須說出來)
- 結局頁 `.helpline`:給獨自遊玩孩子的一行求助指引
- 壞結局的 identity 必須「診斷+留門」,不可停在絕望或本質化定罪(fallen/revenge 已照此改寫);memory 場景正文結尾必須有反宿命句(「這個故事,還沒有寫完」)

### ENDINGS 額外欄位
`hint`(圖鑑未解鎖時的謎語線索)、`identity`(「身份的根」一句解讀:這個約瑟把身份建在哪)、`whatif:true`(圖鑑標 ✦ What-if;fallen/shepherd/revenge)。圖鑑集滿 7 結局顯示「🏆 完整的人」橫幅。

### egypt_lord 的 overrideText
高野心玩家會經由「淚崩相認」的 `resolve` 場景觸發 `egypt_lord`,但寬恕團圓的正文與「質疑野心」的尾聲會人格矛盾。解法:結局渲染時 `paraHTML(E.overrideText || sc.text)`,並在有 overrideText 時抑制 `sc.verse`。若日後新增「主導屬性與 resolve 語氣衝突」的結局,沿用此模式。

### 其他引擎重點
- `journey[]` 每步記錄 `{title, choice, eff, bible, hadB(該幕有無📖選項), icon(分享用 emoji), fic(虛構場景)}`。風險選擇 choice 後標「(成功)/(失敗)」、icon 為 🎲/💥。
- 存檔:`localStorage['joseph_save']`(curId/stats/history/journey/**flags**);已解鎖結局:`localStorage['joseph_endings']`。續玩時 `history.pop()` 再讓 `go()` push,避免重複。
- 屬性列顯示數字(`#n_faith` 等),`renderStats` 同步更新 bar 寬、數字與 aria-label。
- 選項多於 1 個時自動加編號(`.cnum`,給團契喊「選 2 的舉手」用);單一選項渲染成置中「▸ 繼續」樣式(`.single`)。
- `go()` 每次換場景 `window.scrollTo(0,0)`;header 為 sticky(因此 `#app` **不可**設 overflow:hidden,圓角由 header/footer 自己的 border-radius 處理)。
- 插畫:`artSVG(key)` 回傳內嵌 SVG 字串。鍵:`coat/desert/pit/pyramid/house/prison/pharaoh/grain/reunion/good/bad/neutral`。⚠️ 各 SVG 共用 `id="sky"` 漸層——同畫面只顯示一張所以沒問題,但若要同時顯示多張(如做畫廊)須改成唯一 id。
- `<head>` 有 OG/Twitter meta 與 og:image(指向 Pages 網址的 og.png);遊戲網址常數 `GAME_URL`。

## 中文與排版慣例
- **繁體中文**。內文標點用**半形**逗號 `,`、冒號 `:`、問號 `?`、驚嘆號 `!`;對話用全形「」;破折號用 `——`。(全篇一致,別混入全形逗號。)
- 結局圖鑑未解鎖佔位用半形 `???`。

## 開發與驗證流程

**沒有測試框架**,但有一套穩定的 node 驗證手法,改完務必跑:

1. **語法 + 載入 + 圖譜檢查**:抽出 `<script>`,用 DOM/localStorage/window stub `eval` 它,再附加 probe 檢查:
   - 所有 `next` / `risk.success` / `risk.fail` 都存在於 `S`(無斷鏈)
   - 所有 eff(含 successEff/failEff)數值整十
   - 無殘留字樣(早期版本有打字機/音效/`hate`,已全移除,別讓它回來)
2. **DFS 全路徑可達性**:從 `start` 枚舉每個選擇(risk 兩分支都走;`req` 門檻依當下 stats 判斷是否可選),確認**7 個結局全部可達、無「全選項被鎖」的卡死場景**。改動 `pickDynamicEnding`、門檻、或場景連結後**一定要重跑**。
3. **預覽**:本機 `python -m http.server 8765`(專案根目錄),瀏覽器開 `http://localhost:8765/index.html`。
   - `.claude/launch.json` 已設好名為 `static` 的設定可用 preview 工具啟動。
   - ⚠️ Claude_in_Chrome 的 `navigate` 會把 `file://` 錯改成 `https://`,所以**用 http server 而非 file://**。注意可能有多個瀏覽器連線,需先選對本機那台。

> 過往多代理審查(語氣/平衡/聖經/程式)對提升品質很有效;大改後值得再跑一次。

## 已知、刻意未改的可選微調
- **門檻偏鬆**:玩家走某路線時常在用到門檻前就已超過。想要更強的「省點數」張力可調高門檻或降低每步給點,但小心別讓早期門檻變不可達。
- **墜落 / 平凡牧人是一鍵直達**:作為「隨時可放棄」的敘事出口,刻意保留。
- **brothers 的「直接原諒」(信≥50)**:已透過 `forgave_direct` callback 給 resolve 不同開場句,但與「試探」仍殊途同歸到同一動態結局判定。
- **復仇結局觸發點(2 處)多於墜落(1 處)**:結局分佈傾斜是已知狀態,悲劇結局「容易踩到」視為凸顯抉擇重量的設計。

## Git 慣例
- commit 訊息用繁體中文,結尾加 `Co-Authored-By: Claude ...`。
- 只在使用者要求時 commit / push;倉庫遠端為 `origin`(HTTPS,Windows Git Credential Manager 認證)。
