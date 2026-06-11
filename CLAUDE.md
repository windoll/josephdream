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

0. **放射狀架構(2026-06 大重構,取代動態判定)+ 底特律式支線(同月加深)** — **全遊戲只有一條聖經路線、一個聖經結局**(`reconcile` 飽足之地);其餘 10 個結局都是 What-if,**每個結局恰好一條入口選擇、互不重疊、離開就不回來**。`pickDynamicEnding` 已整個刪除——結局由「你在哪裡離開聖經的路」+「在支線盡頭怎麼選」決定。三條主要支線(逃跑/造神/報復)不是一步死,而是**中繼站(branch:true 場景)+ 最後二選**:沉下去 vs 一扇「回頭的門」(折返/揭面/鬆手)——**回頭的門永遠放最後**,且回頭的結局仍不是飽足之地(錯路有真代價,但不絕望——牧養定位)。**改劇情時維持「一結局一入口」不變式**(驗證 probe 會檢查)。
1. **三屬性 = 鑰匙,外加「事件鑰匙」** — 屬性開門(🔒 門檻);`req` 也可以是 `{flag:"...", label:"..."}`——**你做過的事,本身是一把鑰匙**(目前 1 把:brothers 報復門需要 🗝`grudge`,= 第一幕 dothan「記住今天」;第一幕十秒的小決定,決定終幕能不能走進深淵——這是底特律式「前面的小選擇改變後面的門」的招牌示範,別輕易再加,一把就夠點題)。任何改動都要讓屬性/抉擇在過程中實際影響可選項,不能只是默默累積。
   - **機制文法(2026-06 定案,別再堆機制)**:①**主場景固定恰好 3 個選項**,軸序固定「信心→智慧→認同」,**軸序優先於出口位置**——出口放在它所屬的屬性位(如 brothers:信位=直接原諒出口、智位=試探主線、末位=報復出口;dothan 的逃跑出口=智性但屬性位衝突,放末位);例外三種:**小故事場景(id 以 `v_` 開頭)固定單鈕「▸ 繼續」**(eff 全 0、不記入旅程回顧)、**終幕 `test_brothers` 固定 2 選**(相認📖 / 不相認——最後一刻本來就是二元抉擇,使用者定案)、**支線中繼站(wild_years/crowd_kneel/revenge_cell)固定 2 選**(沉下去在前、回頭的門在後);②**全遊戲無隨機性**——「賭一把」已移除(隨機性與「每個選擇都有後果」及牧養定位衝突);③🔒 **所有門檻一律顯示為鎖定按鈕(不可點)**,提示「需要X N,目前 M」+**每個鎖必帶 `lockedNote` 敘事短語**;④結局標籤只有兩種(2026-06 收斂;曾經有「聖經結局/終幕/結局」三詞災難,別再發明新詞):通往 `canonical` 結局的選擇加金色「📖🏁 聖經結局」(**全遊戲恰好 1 個**:test_brothers 相認;金標出現時抑制該選項的 📖 聖經小標,避免雙標),通往結局場景**或 `branch:true` 中繼站**的選擇一律暗紅「🏁 結局」(走進支線=離開主線,入口就要誠實標);⑤**微回應(echo)**:choice 可帶 `echo:"一句話"`,會以 `.echoline` 樣式接在下一幕開頭(結局場景不顯示 echo)。曾因機制太密被玩家反映「故事很亂」,簡化後才定此文法。
   - **菱形分支結構**:4 個分岔點(start/the_pit/egypt/prison)各岔出 3 條屬性小故事(`v_<幕>_faith/wis/amb`)再合回主幹;vizier 只剩信/智兩條(認同位是「造神」出口,原 v_viz_amb「全地的恩人」的創47素材已併入 end_egypt_lord 正文)。共 14 個小故事。內省幕(memory/sons)刻意不岔,用 echo 承接。小故事的屬性效果掛在**父選擇**上,小故事本身 0 eff——所以屬性經濟與門檻平衡不受場景數影響。
   - **三屬性框架 = 三種倚靠(2026-06 換軸定案)**:信心=交託(靠神)、智慧=解題(靠自己把事情解決)、認同=被看見(靠別人的眼光)。前身「野心」因與智慧同屬「靠自己」而被使用者換掉。寫作分界:智慧只寫「看懂/學會/解決」;「人脈、攀附、被記得、讓人欠你、掌聲」一律屬認同;智慧選項禁用「人脈」一詞。
2. **語氣 = 中間偏文學** — 青少年聽得懂、不老氣、但仍有質感與意象。別寫成太文言,也別太幼稚或太網路梗。
3. **聖經淡化為背景** — 保留 📖 標記、章節出處、結局反思,但**故事優先、降低說教感**。經文出處(`ref`)刻意做得小而淡。
4. **What-if 自由想像** — 允許「如果約瑟做了別的選擇」的分支;虛構場景與非聖經結局要**誠實標註**為「虛構支線 / What-if」,不掛真實章節。

## 遊戲引擎架構(都在 `index.html` 的 `<script>`)

### 資料模型
- `stats = {faith, wisdom, ambition}` — 三屬性,起始皆 `20`。內部鍵用英文,UI 顯示「信心/智慧/認同」(⚠️ 第三軸內部鍵仍是 `ambition`,為存檔相容刻意不改;顯示一律走 `STAT_LABEL`)。屬性列副標:交託/解題/被看見。
  - **數值一律整十**(`+10` / `+20` / `−10`)。這是使用者明確要求,務必維持。
- `S` — 場景物件表。用 `scene(id, def)` 註冊。`e(faith,wisdom,ambition)` 是 eff 的簡寫。
- `ENDINGS` — 11 個結局物件,各有 `name / type(「型」標籤) / kind(good|neutral|bad) / reflect / hint / identity`;部分有 `epilogue`。**只有 `reconcile` 是 `canonical:true`(good)**,其餘 10 個全是 `whatif:true`(neutral 或 bad)。`overrideText` 機制已移除(每個結局都有自己的專屬結局場景,正文直接寫在場景裡)。

### 一個 scene 物件可有的欄位
- `title, art(artSVG 的鍵), ref(經文出處), fiction(true 則 ref 顯示「✦ 虛構」樣式), text, verse`
- `ending:"<id>"` — 結局場景(`dynamic`/`pickDynamicEnding` 已於 2026-06 重構移除,所有結局都是固定場景)
- `branch:true` — 一去不回的支線中繼站(wild_years/crowd_kneel/revenge_cell):入口選項自動掛暗紅 🏁,場景固定 2 選
- `choices: [...]`,每個 choice 可有:
  - `text, next, eff`(可含負值 = 取捨)
  - `bible:true` — 顯示「📖 聖經」標籤(代表符合聖經記載)
  - `req: {stat, val}` 或 `req: {flag, label}`,皆配 `lockedNote:"——敘事短語"` — **門檻**。不夠時一律顯示 🔒 鎖定按鈕(不可點);屬性鎖提示「需要信心 50,目前 30」,事件鎖提示「需要:🗝 <label>」,皆接 lockedNote。**每個門檻都必須帶 lockedNote;flag 鎖必須帶 label**。目前 6 個鎖:dothan 逃跑(智30,出口)、the_pit 誇口(認40)、temptation 智取(智40)、vizier 造神(認60,出口)、brothers 直接原諒(信50,出口)、brothers 報復(🗝grudge,出口)。(prison 第三選項「求記念」是聖經記載[創40:14],刻意**不**上鎖;它原本掛 📖,2026-06 依使用者決定移除——**每幕最多一個 📖 腳蹤**,「一條聖經路線」才讀得乾淨。小故事 v_pri_amb 仍保留創40:14 出處,記載本身不抹掉。)上鎖出口分屬三屬性+一事件=「練什麼/做過什麼,開什麼門」。
  - ~~`risk`~~ — **風險賭注機制已於 2026-06 整個移除**(理由見機制文法②)。引擎裡已無 risk 處理;若日後想恢復,記得 doChoice/renderChoices/journey icon/標題說明四處都要加回,且先重讀機制文法的反對理由。
  - `flag:"name"` — 點選後設 `flags[name]=true`(隨存檔保存),供 callback 使用。

### Callback(讓遊戲記得早期選擇)
`CALLBACKS` 表(scene id → fn 回傳 `{pre,post}`),在 `go()` 渲染時把 pre/post 段落接到場景文字前後。目前只剩兩個:`outwit`(智取主母)→prison 加開場句;`grudge`(多坍記恨)→brothers 加一段。(`fled`/`forgave_direct`/`tested` 等條件文已隨 2026-06 放射狀重構移除——逃跑/直接原諒不再匯回主線,不需要條件版本。)`sc.text` 仍**可以是函式**,但目前全部是定字串。**便雅憫在場規則**:brothers 開場是十人(創42 第一次來糧,便雅憫不在場)——所以 revenge1 寫「扣西緬」(創42:24)、end_halfway 寫「打發車輛接父親與便雅憫」、便雅憫本人只出現在 test_brothers 之後(該場景開頭有「扣西緬作保→第二次來糧」過場句)。改終幕文案時別把便雅憫寫回第一次來糧的場景。新增 callback 時用 flags,別解析 journey 文字。

### 結局架構(放射狀+支線分岔:一結局一入口,無動態判定)
| 結局 id | 名稱 | kind | 唯一入口 | 門檻 |
|---|---|---|---|---|
| `reconcile` | 飽足之地 📖 | good, canonical | test_brothers 相認 | 無(聖經路線人人可走) |
| `runaway` | 逃走的人 | neutral | wild_years 關上消息 | (支線門:智30) |
| `homeward` | 回家的長路 | neutral | wild_years 往南走 | (支線門:智30) |
| `fallen` | 墜落 | bad | temptation 屈服 | 無 |
| `shepherd` | 平凡的牧人 | neutral | pharaoh 婉拒 | 無 |
| `egypt_lord` | 萬人的掌聲 | neutral | crowd_kneel 藏回妝底 | (支線門:認60) |
| `grand_reunion` | 盛大的相認 | neutral | crowd_kneel 萬人前揭面 | (支線門:認60) |
| `halfway` | 半路上的和好 | neutral | brothers 直接原諒 | 信50 |
| `revenge` | 復仇的筵席 | bad | revenge_cell 執行到底 | (支線門:🗝grudge) |
| `relent` | 懸崖邊收手 | neutral | revenge_cell 鬆手 | (支線門:🗝grudge) |
| `nameless` | 無名的恩人 | neutral | test_brothers 不相認 | 無 |

(舊動態結局 `faith_crown`/`wise_savior` 已刪除,載入 `joseph_endings` 時自動過濾舊 id。`egypt_lord`/`halfway` 沿用舊 id 保圖鑑相容。revenge_cell 的牢中認罪一段出自創42:21–22,是支線裡少數真實記載,ref 已標註。)

### 主要場景流向
`start →[v_start_faith/wis/amb]→ dothan →`(站住📖 / 記恨🗝grudge / 逃跑[智≥30]🏁→`wild_years`→逃走的人/回家的長路)`→ the_pit →[v_pit_faith/wis/amb]→ memory(父親的故事,主題①) → egypt →[v_egy_faith/wis/amb]→ temptation →`(逃離📖→`prison` / 智取[智≥40]→`outwit→prison` / 屈服🏁→`end_fallen`)`→ prison →[v_pri_faith/wis/amb,被遺忘的兩年]→ pharaoh →`(宣告📖 / 獻策 →`sons`;婉拒🏁→`end_shepherd`)`→ sons(兩個名字,主題③) → vizier →`(公義賣糧📖→`v_viz_faith` / 糧政→`v_viz_wis` →`brothers`;造神[認≥60]🏁→`crowd_kneel`→萬人的掌聲/盛大的相認)`→ brothers →`(直接原諒[信≥50]🏁→`end_halfway` / 試探📖→`test_brothers` / 報復[🗝grudge]🏁→`revenge_cell`→復仇的筵席/懸崖邊收手)。`test_brothers →`(相認📖🏁→`resolve`=`reconcile` / 不相認🏁→`end_nameless`)。共 41 場景(主場景 13 含 outwit+中繼站 3+結局場景 11+小故事 14),聖經主線一輪約 17 幕/7 分鐘,全程無隨機。
小故事中有真實經文可掛的:v_start_amb(創37:9–11)、v_egy_faith(創39:3–6)、v_pri_faith(創40:20–23;41:1)、v_pri_amb 求你記念我(創40:14–23;41:1,verse 詩146:3——「靠人=被忘記」是認同軸的招牌場景)、v_viz_faith(創41:53–57);end_egypt_lord 正文素材呼應創47:13–26(已在 ref 標註);其餘標「虛構場景」。

### 標題畫面與啟動流程
啟動一律呼叫 `showTitle()`(不在 `S` 裡,DFS 驗證不用管它):標題卡+玩法說明(三種倚靠/📖/🔒/🏁),偵測到存檔顯示「繼續上次/從頭開始」。footer 有 ⌂ 封面鈕;「重新開始」走自製 confirm modal(`#confirmBg`),不用原生 confirm()。

### 結局頁區塊(順序固定)
結局標頭(name/type「你是【X型】的約瑟」/kind/canonical)→ 正文(場景 text+callback)→ `epilogue` → verse → `nearMissHTML`(差一點解鎖提示:指向「還沒開過的鎖門」,取 gap 最小一條)→ `bibleLineHTML`(📖 X/Y 統計)→ reflect → `identity`(🌱 身份的根,主題③)→ `discHTML()`(摺疊式討論題+列印鈕)→ journey 回顧(含 ✦ 虛構標記;「本局行經」經文清單已依使用者要求移除)。按鈕:分享(navigator.share→clipboard fallback)/再玩/圖鑑。

### 討論題(固定一套,不分結局)——牧養安全規範
`DISC` 常數 5 題,結構是刻意的「三段安全橋」:第 1–2 題只談約瑟家(第三人稱)→ 第 3 題**第三方例子優先**(戲劇/電影/別人家;「想講自己家也可以,但完全不必」)→ 第 4 題完全私密(「在心裡想就好」+ 條件語「如果有的話」+「將來」)→ 第 5 題身份在神(瑪拿西引文**必須**帶重釋「忘了不是假裝沒發生,而是那些事不再替他做決定」;約1:12 保留「凡接待他的」條件語氣)。**改題目時必須保持這個梯度與保護措辭。**

經創傷知情審查後的固定防線(別刪):
- 帶領者註三行:全題可 pass / 第4題不點名不追問不書寫回收 / 揭露現行傷害的接應原則 + **「原諒不等於回到會繼續傷害你的關係裡」**(約瑟是在哥哥們真的改變後才相認——這層意義必須說出來)
- 結局頁 `.helpline`:給獨自遊玩孩子的一行求助指引
- 壞結局的 identity 必須「診斷+留門」,不可停在絕望或本質化定罪(fallen/revenge 已照此改寫);memory 場景正文結尾必須有反宿命句(「這個故事,還沒有寫完」)

### ENDINGS 額外欄位
`hint`(圖鑑未解鎖時的謎語線索)、`identity`(「身份的根」一句解讀:這個約瑟把身份建在哪)、`whatif:true`(圖鑑標 ✦ What-if;**reconcile 以外全部都是**)。圖鑑集滿 11 結局顯示「🏆 完整的人」橫幅。

### 路線圖(🗺,2026-06 新增——重玩動力的主引擎)
底特律式流程圖,footer「🗺 路線圖」+ 結局頁按鈕開啟,`openMap()` 純 SVG 手排版(寬 1300,手機橫向捲動 `.mapwrap`)。資料三件套:`MAP_MAIN`(主幹 12 節點)/`MAP_NODES`(中繼站+結局格,**座標手排,改場景記得同步**,並跑 probe 的 map 完整性檢查)/`MAP_EDGES`+`MAP_VIGNETTES`(小故事顯示為分岔點上方的小圓點)。走過的場景記在 `localStorage['joseph_seen']`(`seenScenes`/`markSeen`,跨輪保留,如同圖鑑),點亮節點與路徑;未解鎖結局格顯示 `???`,**鎖門的鑰匙(智30/認60/信50/🗝記恨)在地圖上永遠可見**——「看得到開不了」就是重玩鉤子。改版面後用 getBBox 重疊檢查(text-text / rect-rect 不可相交)。

### 其他引擎重點
- `journey[]` 每步記錄 `{title, choice, eff, bible, hadB(該幕有無📖選項), icon(分享用 emoji:📖/✨/💡/🌟/▪️), fic(虛構場景)}`。小故事的單鈕「繼續」(無 eff、無 bible)不記錄。
- 存檔:`localStorage['joseph_save']`(curId/stats/history/journey/**flags**);已解鎖結局:`localStorage['joseph_endings']`;路線圖足跡:`localStorage['joseph_seen']`。續玩時 `history.pop()` 再讓 `go()` push,避免重複。
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
   - 所有 `next` 都存在於 `S`(無斷鏈)
   - 所有 eff 數值整十
   - 無殘留字樣(早期版本有打字機/音效/`hate`/`risk` 賭注,已全移除,別讓它回來)
2. **DFS 全路徑可達性 + 不變式**:從 `start` 枚舉每個選擇(`req` 門檻依當下 stats 判斷是否可選),確認**11 個結局全部可達(DFS 狀態須含 flags,事件鑰匙才判得對)、無「全選項被鎖」的卡死場景、每個結局恰好一條入口選擇(無重疊)、金色聖經結局標全遊戲恰好 1 個、MAP_* 資料與 S/ENDINGS 一致**。改動門檻、場景連結或路線圖後**一定要重跑**。
3. **預覽**:本機 `python -m http.server 8765`(專案根目錄),瀏覽器開 `http://localhost:8765/index.html`。
   - `.claude/launch.json` 已設好名為 `static` 的設定可用 preview 工具啟動。
   - ⚠️ Claude_in_Chrome 的 `navigate` 會把 `file://` 錯改成 `https://`,所以**用 http server 而非 file://**。注意可能有多個瀏覽器連線,需先選對本機那台。

> 過往多代理審查(語氣/平衡/聖經/程式)對提升品質很有效;大改後值得再跑一次。

## 已知、刻意未改的可選微調
- **門檻偏鬆**:玩家走某路線時常在用到門檻前就已超過(認60 的造神門例外,需要刻意經營)。想調張力可調高門檻或降低每步給點,但小心別讓門檻變不可達,改完必跑 DFS。
- **墜落 / 平凡牧人 / 不相認是無門檻一鍵直達**:作為「隨時可離開」的敘事出口,刻意保留。(報復自 2026-06 起需要 🗝grudge 事件鑰匙,不再是一鍵直達。)
- **聖經路線無任何門檻**:照著 📖 走必達 `reconcile`——刻意的牧養陳述(跟隨聖經的路不需要先變強),別給聖經選項上鎖。

## Git 慣例
- commit 訊息用繁體中文,結尾加 `Co-Authored-By: Claude ...`。
- 只在使用者要求時 commit / push;倉庫遠端為 `origin`(HTTPS,Windows Git Credential Manager 認證)。
