# PULSE｜Import Batch & Documents 資料治理驗收報告（Release Gate）

## 1. 範圍與決策狀態

本報告覆蓋 **Documents / Import Batch** 之資料治理底線與其驗收結果。
所有下列項目已 **Decision Locked**（不得回退／不得再更動 DB 行為）：

* `documents.doc_type`：短值 enum + DB CHECK constraint 強制合法值
* 同一 `(project_id, doc_type)` 僅允許一筆 current（partial unique index）
* 同一 `(project_id, doc_type, version)` 不可重複（unique index）
* Import Batch：三段式寫入 + rollback 規則（避免 current 空窗與 race condition）
* `document_files`：不加入 `doc_type_code / agency_code`，僅存檔案屬性與 `document_id`

限制條件：

* Lovable 平台內開發
* 無法直接操作 Supabase UI
* 驗收以 SQL 查詢、實際 insert 黑箱測試、前端 UI 實測為準

---

## 2. 驗收結果摘要

| 驗收項目                            | 結果        | 證據摘要                                                                                                                                  |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A1. `doc_type` CHECK constraint | ✅ PASS    | CHECK 限制 8 種短值；非法值（例：`台電躉售合約`）被拒（23514）；合法短值（例：`躉售合約`）可寫入                                                                             |
| A2. one-current partial unique  | ✅ PASS    | `UNIQUE (project_id, doc_type) WHERE is_current=true AND is_deleted=false AND is_archived=false`；違規資料 0 筆；重複 current insert 被拒（23505） |
| A3. version unique index        | ✅ PASS    | `UNIQUE (project_id, doc_type, version) WHERE is_deleted=false`；違規資料 0 筆；重複 version insert 被拒（23505）                                  |
| B. `document_files` 欄位結構        | ✅ PASS    | `document_id`, `original_name`, `storage_path`, `file_size`, `mime_type`, `uploaded_by` 全部存在且符合寫入需求                                   |
| C. Import Batch UI 上傳實測         | ⏳ PENDING | 需於 `/import-batch` 完成真實檔案情境測試（見第 3 節）                                                                                                 |
| D. dev-verification 已移除         | ✅ PASS    | `/dev-verification` route 與頁面檔案已刪除；build 成功                                                                                           |

結論（目前）：**DB 層治理全部 PASS。待完成 UI 實測（C）後，即可視為 Phase 1 MVP 可交付。**

---

## 3. Import Batch UI 實測腳本（必做）

> 目標：在真實檔案與實際 UI 操作下，驗證「版本遞增」「current 唯一」「錯誤提示可理解」「失敗不污染資料」。

### 3.1 測試前置條件

* 選定一個 `project_id`（建議：測試專案，避免污染正式資料）
* 準備至少 3 個檔案（可用任意 PDF / DOCX / PNG）：

  * `file_A.pdf`
  * `file_B.pdf`
  * `file_C.pdf`

### 3.2 測試情境與 PASS/FAIL 標準

#### 情境 C1｜同案場＋同 doc_type：連續上傳兩次（版本遞增 + current 切換）

**步驟**

1. 進入 `/import-batch`
2. 選定同一 `project`
3. doc_type 選 `躉售合約`
4. 上傳 `file_A.pdf` → 送出
5. 同樣條件再上傳 `file_B.pdf` → 送出

**預期結果（PASS 條件）**

* 版本號遞增：第二次的 version = 第一次 version + 1
* `is_current` 唯一：最新版本為 current；上一版本不再是 current
* UI 顯示清楚（至少能辨識哪個是 current）

**FAIL 條件**

* 版本未遞增、重複、或 UI 顯示不一致
* 出現兩筆 current 或 current 消失

---

#### 情境 C2｜同批次多檔案（批次穩定性 + 結果可辨識）

**步驟**

1. 同一 `project`
2. doc_type 依序上傳：

   * `同意備案`：`file_A.pdf`
   * `結構簽證`：`file_B.pdf`
   * `報竣掛表`：`file_C.pdf`

**PASS**

* 三筆皆成功
* 每一筆都能在 UI 找到對應記錄（包含檔名或上傳時間等可辨識資訊）
* current 正確（各 doc_type 都只有一筆 current）

---

#### 情境 C3｜故意製造失敗（最重要：不污染 current）

> 你已在治理層驗證 rollback 規則；此處要驗證 UI 觸發真實錯誤時，使用者看到的結果合理。

**建議作法（擇一即可）**

* 上傳一個明顯不支援的檔案型態（若 UI 有限制）
* 或在上傳過程中中斷（例如切網路/重新整理，視環境允許）
* 或觸發後端回傳錯誤（若系統已有可重現的錯誤情境）

**PASS**

* 舊 current 不受影響（仍存在且仍是 current）
* 不會出現 current 空窗
* UI 錯誤訊息能讓使用者判斷「是否需要重試」與「是否有部分成功」

**FAIL**

* current 變成 0
* 出現兩筆 current
* 使用者無法判斷是否已寫入成功（結果不透明）

---

## 4. 發版前最後清理清單（Release Checklist）

* [x] 移除 `/dev-verification` route
* [x] 移除 dev-verification page 檔案
* [ ] 搜尋並確認無殘留 dev-only 文案／按鈕（例如註解 “Dev-only verification page”）
* [ ] Import Batch UI：錯誤訊息不直接暴露 23505/23514（允許 console/log 保留）
* [ ] 完成第 3 節 C1~C3（至少 C1 + C3 必做）
* [ ] 以真實檔案走完整流程後，確認 UI 無 console error / 無未處理 promise rejection

---

## 5. 最終結論

* **資料層（DB constraint/index）：已驗收通過，風險極低**
* **寫入邏輯（Three-Stage + rollback）：已驗收通過**
* **UI 實測：待完成（C1~C3）**
  完成後即可宣告 **Import Batch Phase 1 MVP Done**。

