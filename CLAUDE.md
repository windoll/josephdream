# CLAUDE.md — 專案開發指南

> 給 Claude / 協作者:接手本專案前先讀這份。記錄了**從程式碼看不出來**的架構意圖、設計決策與驗證流程。

## 專案是什麼

「**約瑟的夢 — 十七歲的抉擇**」:以聖經創世記約瑟故事為基底、**為青少年設計**的網頁文字冒險遊戲。
單檔遊戲,**所有東西都在 `index.html`**(HTML + CSS + 內嵌 SVG + 原生 JS,無任何相依套件、無建置步驟)。

倉庫:https://github.com/windoll/josephdream (`main` 分支)

### 檔案結構
- `index.html` — 整個遊戲(樣式、插畫、引擎、劇情全在這)
- `README.md` — 給玩家/訪客看的公開說明
- `CLAUDE.md` — 本檔
- `.gitignore` — 排除 `.claude/`(本地設定、launch.json 等不進倉庫)

## 核心設計理念(最重要,別破壞)

這款遊戲的目標受眾是**青少年**,核心訴求是「**讓選擇真的有後果**」。歷經多次改版後的定案:

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
- `title, art(artSVG 的鍵), ref(經文出處), fiction(true 則 ref 標紅淡色), text, verse`
- `ending:"<id>"` — 直接結局場景
- `dynamic:true` — 由 `pickDynamicEnding()` 依當下屬性決定結局(目前只有 `resolve`)
- `choices: [...]`,每個 choice 可有:
  - `text, next, eff`(可含負值 = 取捨)
  - `bible:true` — 顯示「📖 聖經」標籤(代表符合聖經記載)
  - `cond: s=>bool` + `lockedHint:"..."` — **屬性門檻**。不符時:有 lockedHint 就顯示 🔒 鎖定按鈕(disabled),否則整個選項隱藏。
  - `risk: {stat, bonus, success, fail, successEff, failEff}` + `tag` — **風險賭注**。`doChoice` 用機率 `p = clamp(stats[stat]+bonus, 10, 90)`,`Math.random()*100 < p` 決定成敗,各走 success/fail 場景、套各自 eff。⚠️ 改 risk 結構時記得同步改 `doChoice`(曾因只改資料沒改 handler 而出 bug)。

### 結局判定 `pickDynamicEnding()`(寬恕路線終局)
順序很重要,別隨意調:
1. `ambition>=60 && 野心嚴格最大` → `egypt_lord`(埃及的權臣)
2. `faith>=50 && wisdom>=50` → `reconcile`(飽足之地,canonical,**最圓滿**)
3. `faith>=60 && 信心嚴格最大` → `faith_crown`
4. `wisdom>=60 && 智慧嚴格最大` → `wise_savior`
5. 其餘 → `reconcile`

> **設計重點**:`reconcile` 要求信心+智慧雙高,所以「砍信心換野心」的取捨**會讓你失去最圓滿的結局**——這是取捨「有代價」的關鍵機制,別改回單純比大小。

### 主要場景流向
`start → dothan →`(風險:`flee_wild` 成功 / `the_pit` 失敗,或直接 `the_pit`)`→ egypt → temptation →`(逃離→`prison` / 智取→`outwit1→outwit2→prison` / 屈服→`end_fallen`)`→ prison → pharaoh →`(`vizier` / 婉拒→`end_shepherd`)`→ vizier → brothers →`(寬恕[信≥50]→`resolve` / 試探→`test_brothers` / 報復→`revenge1`)。`test_brothers →`(相認→`resolve` / 報復→`revenge1`)。`resolve` 為 dynamic 終局。

### egypt_lord 的 overrideText
高野心玩家會經由「淚崩相認」的 `resolve` 場景觸發 `egypt_lord`,但寬恕團圓的正文與「質疑野心」的尾聲會人格矛盾。解法:結局渲染時 `paraHTML(E.overrideText || sc.text)`,並在有 overrideText 時抑制 `sc.verse`。若日後新增「主導屬性與 resolve 語氣衝突」的結局,沿用此模式。

### 其他引擎重點
- `journey[]` 記錄每步選擇(結局畫面的「你的旅程」回顧)。風險選擇會在 choice 後標「(成功)/(失敗)」。
- 存檔:`localStorage['joseph_save']`(curId/stats/history/journey);已解鎖結局:`localStorage['joseph_endings']`。`init()` 續玩時 `history.pop()` 再讓 `go()` push,避免重複。
- 插畫:`artSVG(key)` 回傳內嵌 SVG 字串。鍵:`coat/desert/pit/pyramid/house/prison/pharaoh/grain/reunion/good/bad/neutral`。⚠️ 各 SVG 共用 `id="sky"` 漸層——同畫面只顯示一張所以沒問題,但若要同時顯示多張(如做畫廊)須改成唯一 id。

## 中文與排版慣例
- **繁體中文**。內文標點用**半形**逗號 `,`、冒號 `:`、問號 `?`、驚嘆號 `!`;對話用全形「」;破折號用 `——`。(全篇一致,別混入全形逗號。)
- 結局圖鑑未解鎖佔位用半形 `???`。

## 開發與驗證流程

**沒有測試框架**,但有一套穩定的 node 驗證手法,改完務必跑:

1. **語法 + 載入 + 圖譜檢查**:抽出 `<script>`,用 DOM/localStorage/window stub `eval` 它,再附加 probe 檢查:
   - 所有 `next` / `risk.success` / `risk.fail` 都存在於 `S`(無斷鏈)
   - 所有 eff 數值整十
   - 無殘留字樣(早期版本有打字機/音效/`hate`,已全移除,別讓它回來)
2. **DFS 全路徑可達性**:從 `start` 枚舉每個選擇(含 risk 兩分支、cond 依當下 stats),確認**7 個結局全部可達**。改動 `pickDynamicEnding`、門檻、或場景連結後**一定要重跑**。
3. **預覽**:本機 `python -m http.server 8765`(專案根目錄),瀏覽器開 `http://localhost:8765/index.html`。
   - `.claude/launch.json` 已設好名為 `static` 的設定可用 preview 工具啟動。
   - ⚠️ Claude_in_Chrome 的 `navigate` 會把 `file://` 錯改成 `https://`,所以**用 http server 而非 file://**。注意可能有多個瀏覽器連線,需先選對本機那台。

> 過往多代理審查(語氣/平衡/聖經/程式)對提升品質很有效;大改後值得再跑一次。

## 已知、刻意未改的可選微調
- **門檻偏鬆**:玩家走某路線時常在用到門檻前就已超過。想要更強的「省點數」張力可調高門檻或降低每步給點,但小心別讓早期門檻變不可達。
- **墜落 / 平凡牧人是一鍵直達**:作為「隨時可放棄」的敘事出口,刻意保留。
- **brothers 的「直接原諒」(信≥50)門檻偏裝飾**:與無門檻的「試探」殊途同歸到 resolve;要讓它有後果可給兩條路不同尾聲傾向。

## Git 慣例
- commit 訊息用繁體中文,結尾加 `Co-Authored-By: Claude ...`。
- 只在使用者要求時 commit / push;倉庫遠端為 `origin`(HTTPS,Windows Git Credential Manager 認證)。
