# 專案中樞摘要 v2.0

## 專案階段與權威來源
- **階段**：Phase 1 - 平台內整合與驗證期
- **權威來源**：Lovable 平台 + Supabase（Postgres）為唯一程式碼與資料來源
- **部署環境**：Lovable 平台內部環境

## 系統目的與核心能力
- **系統名稱**：光電專案管理系統（Solar Project Management System）
- **核心能力**：
  - 專案（Project）生命週期管理
  - 投資人（Investor）與協力商（Partner）管理
  - 文件（Document）與檔案管理
  - 進度里程碑追蹤
  - 角色與模組權限控制
  - 稽核日誌記錄

## 現行資料模型（以實際資料表為準）
### 核心業務實體
| 資料表 | 用途 |
|--------|------|
| `projects` | 專案主檔（含 Drive 同步欄位、進度欄位） |
| `investors` | 投資人主檔 |
| `partners` | 協力商主檔 |
| `documents` | 文件主檔（含版本控制） |
| `document_files` | 文件附件檔案 |

### 聯絡人與付款
| 資料表 | 用途 |
|--------|------|
| `investor_contacts` | 投資人聯絡人（支援多筆、角色標籤） |
| `partner_contacts` | 協力商聯絡人 |
| `investor_payment_methods` | 投資人付款方式 |

### 進度與狀態追蹤
| 資料表 | 用途 |
|--------|------|
| `progress_milestones` | 里程碑定義（admin/engineering 類型） |
| `project_milestones` | 專案與里程碑完成狀態關聯 |
| `project_status_history` | 專案狀態變更歷史 |
| `construction_status_history` | 工程狀態變更歷史 |
| `project_construction_assignments` | 工程發包紀錄 |

### 使用者與權限
| 資料表 | 用途 |
|--------|------|
| `profiles` | 使用者基本資料 |
| `user_roles` | 使用者角色與審核狀態（admin/staff/viewer） |
| `module_permissions` | 模組層級 CRUD 權限 |
| `user_preferences` | 使用者偏好設定 |
| `user_security` | 密碼安全與強制變更 |

### 系統配置與治理
| 資料表 | 用途 |
|--------|------|
| `system_options` | 動態下拉選項管理 |
| `app_settings` | 品牌設定（名稱、Logo、顏色） |
| `deletion_policies` | 刪除策略定義 |
| `audit_logs` | 稽核日誌 |

### 擴充與整合
| 資料表 | 用途 |
|--------|------|
| `project_custom_fields` | 自訂欄位定義 |
| `project_custom_field_values` | 自訂欄位值 |
| `project_field_config` | 欄位顯示配置 |
| `user_drive_tokens` | Google Drive OAuth 令牌 |
| `investor_year_counters` | 投資人年度流水號計數 |
| `duplicate_ignore_pairs` | 重複專案忽略配對 |
| `duplicate_reviews` | 重複專案審查記錄 |

### 檢視表（Views）
| 檢視表 | 用途 |
|--------|------|
| `project_analytics_view` | 專案分析彙總檢視 |
| `document_analytics_view` | 文件分析彙總檢視 |

---

## 現行技術棧與執行方式

| 層級 | 技術 |
|------|------|
| Frontend | React 18 + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| 狀態管理 | TanStack Query（React Query） |
| Database | Supabase（Postgres 14.1） |
| Auth | Supabase Auth |
| API 呼叫 | 前端直連 Supabase Client + Edge Functions 混用 |
| 檔案儲存 | Supabase Storage（buckets: documents, branding） |

### 已存在的 Edge Functions
- `admin-approve-user` / `admin-create-user` / `admin-delete-user` / `admin-reset-password` / `admin-update-role`
- `create-project-with-seq` / `recalculate-project-progress`
- `drive-auth-url` / `drive-auth-callback` / `drive-test-connection` / `drive-find-root-folder` / `drive-verify-folder` / `drive-ensure-folders` / `drive-upload-file` / `create-drive-folder`
- `send-notification-email`
- `system-operations`
- `user-change-password`

---

## 已存在的治理／控制機制

### 軟刪除機制
- 欄位：`is_deleted` / `deleted_at` / `deleted_by` / `delete_reason`
- 適用表：projects, investors, partners, documents, document_files, investor_contacts, partner_contacts, investor_payment_methods, project_construction_assignments

### 封存機制
- 欄位：`is_archived` / `archived_at` / `archived_by` / `archive_reason`
- 適用表：projects, investors, partners, documents

### 刪除策略治理
- 表：`deletion_policies`
- 模式：soft_delete / archive / hard_delete / disable_only
- 可配置：retention_days / require_reason / require_confirmation / allow_auto_purge

### 稽核日誌
- 表：`audit_logs`
- 動作類型：DELETE / RESTORE / PURGE / ARCHIVE / UNARCHIVE / CREATE / UPDATE / DB_RESET / DB_EXPORT / DB_IMPORT / BRANDING_UPDATE

### 權限控制
- 角色層級：`user_roles`（admin / staff / viewer）
- 模組層級：`module_permissions`（can_view / can_create / can_edit / can_delete）
- 使用者狀態：pending / active / rejected / disabled

### RLS 政策
- 所有業務表皆啟用 Row Level Security
- 以 `has_role()` / `has_any_role()` 函數控制存取

---

## 已知限制與未落實項目

| 項目 | 狀態 |
|------|------|
| 通用組織抽象層（Organization/Party） | 未實作，目前以 investors/partners 分開處理 |
| 統一 API 邊界規範 | 未定義，前端直連與 Edge Functions 混用 |
| 回收站 UI | 頁面存在（RecycleBin.tsx），實際資料查詢邏輯未確認 |
| 自動清除軟刪除資料 | deletion_policies 有 allow_auto_purge 欄位，排程機制未確認 |

---

## 未來規劃（非既有事實）
- Phase 3：系統穩定後遷移至 NAS / 自管環境
- 遷移前提條件（待落實）：
  - 資料表結構穩定
  - 權限模型明確
  - API 邊界清楚定義

---

## 中樞摘要更新提醒規則

本摘要僅在以下情況需更新：
1. **核心資料模型被新增、刪除或重構**
2. **權限／刪除／稽核等治理機制被改變**
3. **系統權威來源或部署模式改變**

---

*生成日期：2026-01-04*
*版本：v2.0*
