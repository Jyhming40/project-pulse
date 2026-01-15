# Dashboard 指標盤點表

## 總覽

| 區塊 | 指標數 | 資料來源 |
|------|--------|----------|
| HealthKPICards | 4 | project_analytics_view, projects |
| ActionRequiredSection | 3 | project_analytics_view, projects |
| PhaseOverviewSection | 7+ | projects |
| Phase2TracksSection | 12+ | projects, project_payments |
| AdministrativeSection | 4+清單 | projects |
| EngineeringSection | 4+清單 | projects |
| RiskSection | 3+清單 | projects |
| StatusDistributionChart | 2 | project_analytics_view |

---

## 詳細指標清單

### 1. HealthKPICards
| 指標名稱 | 檔案路徑 | 元件/函式 | 資料表 | 欄位 | 條件 | 排除 archived/deleted | 風險註記 |
|----------|----------|-----------|--------|------|------|----------------------|----------|
| 總案場數 | src/hooks/useProjectAnalytics.ts | useAnalyticsSummary() | project_analytics_view | COUNT(*) | 無 | view 已排除 | ✅ 安全 |
| 風險案場 | src/hooks/useProjectAnalytics.ts | useAnalyticsSummary() | project_analytics_view | has_risk | has_risk=true AND status NOT IN ('暫停','取消') | view 已排除 | ⚠️ 依賴 view 的 has_risk 計算邏輯 |
| 待補件 | src/pages/Dashboard.tsx | pendingFixCount | projects | status | status='台電審查' | is_deleted=false | ⚠️ 用中文 label 當 key |
| 平均進度 | src/hooks/useProjectAnalytics.ts | useAnalyticsSummary() | project_analytics_view | overall_progress_percent | status NOT IN ('暫停','取消') | view 已排除 | ✅ 安全 |

### 2. ActionRequiredSection
| 指標名稱 | 檔案路徑 | 元件/函式 | 資料表 | 欄位 | 條件 | 排除 archived/deleted | 風險註記 |
|----------|----------|-----------|--------|------|------|----------------------|----------|
| 風險案場數 | src/hooks/useProjectAnalytics.ts | useRiskProjects() | project_analytics_view | has_risk | has_risk=true | view 已排除 | ⚠️ 依賴 view 的 has_risk 計算邏輯 |
| 待補件數 | src/components/dashboard/ActionRequiredSection.tsx | pendingFixProjects | projects (props) | status | status='台電審查' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 超時未更新數 | src/components/dashboard/ActionRequiredSection.tsx | stuckProjects | projects (props) | updated_at | updated_at < (now-14days) AND status NOT IN ('暫停','取消','運維中') | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |

### 3. PhaseOverviewSection
| 指標名稱 | 檔案路徑 | 元件/函式 | 資料表 | 欄位 | 條件 | 排除 archived/deleted | 風險註記 |
|----------|----------|-----------|--------|------|------|----------------------|----------|
| Phase1 總數 | src/components/dashboard/PhaseOverviewSection.tsx | phaseData.phase1.total | projects (props) | status | status IN ('開發中','土地確認','結構簽證','台電送件','台電審查','能源署送件','無饋線') AND status NOT IN ('暫停','取消') | Dashboard 已過濾 | ⚠️ 硬編碼狀態清單 |
| Phase1 開發準備 | 同上 | phase1Breakdown.developing | projects (props) | status | status IN ('開發中','土地確認','結構簽證') | Dashboard 已過濾 | ⚠️ 硬編碼狀態清單 |
| Phase1 台電審查 | 同上 | phase1Breakdown.submitting | projects (props) | status | status IN ('台電送件','台電審查','無饋線') | Dashboard 已過濾 | ⚠️ 硬編碼狀態清單 |
| Phase1 能源署 | 同上 | phase1Breakdown.energyReview | projects (props) | status | status='能源署送件' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| Phase2 總數 | 同上 | phaseData.phase2.total | projects (props) | status | status IN ('同意備案','工程施工','報竣掛表','設備登記','運維中') | Dashboard 已過濾 | ⚠️ 硬編碼狀態清單 |
| Phase2 細分 | 同上 | phase2Breakdown.* | projects (props) | status | 各狀態獨立計數 | Dashboard 已過濾 | ⚠️ 硬編碼狀態清單 |
| 暫停/取消 | 同上 | phaseData.inactive | projects (props) | status | status='暫停' / status='取消' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |

### 4. Phase2TracksSection
| 指標名稱 | 檔案路徑 | 元件/函式 | 資料表 | 欄位 | 條件 | 排除 archived/deleted | 風險註記 |
|----------|----------|-----------|--------|------|------|----------------------|----------|
| 行政線進度 | src/components/dashboard/Phase2TracksSection.tsx | trackData.admin.avgProgress | projects (props) | admin_progress | status IN PHASE2_STATUSES | Dashboard 已過濾 | ⚠️ 硬編碼狀態清單 |
| 行政線完成 | 同上 | trackData.admin.completed | projects (props) | status | status='運維中' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 行政線卡關 | 同上 | trackData.admin.bottlenecks | projects (props) | construction_status, status | construction_status IN ('已完工','已掛錶') AND status IN ('同意備案','工程施工','報竣掛表') | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 工程線進度 | 同上 | trackData.engineering.avgProgress | projects (props) | engineering_progress | status IN PHASE2_STATUSES | Dashboard 已過濾 | ⚠️ 硬編碼狀態清單 |
| 工程線完成 | 同上 | trackData.engineering.completed | projects (props) | construction_status | construction_status IN ('已完工','已掛錶') | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 工程線暫緩 | 同上 | trackData.engineering.onHold | projects (props) | construction_status | construction_status='暫緩' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 財務待請款 | 同上 | trackData.financial.pendingAmount | project_payments | contract_amount | payment_status='pending' | 無過濾 | ⚠️ 未排除已刪除專案 |
| 財務已收款 | 同上 | trackData.financial.paidAmount | project_payments | paid_amount | payment_status='paid' | 無過濾 | ⚠️ 未排除已刪除專案 |
| 收款率 | 同上 | trackData.financial.collectionRate | project_payments | 計算 | paid/(pending+invoiced+paid) | 無過濾 | ⚠️ 未排除已刪除專案 |
| 營運已掛表 | 同上 | trackData.operations.meterInstalled | projects (props) | construction_status, status | construction_status='已掛錶' OR status IN ('設備登記','運維中') | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 營運已登記 | 同上 | trackData.operations.equipmentRegistered | projects (props) | status | status IN ('設備登記','運維中') | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 營運運維中 | 同上 | trackData.operations.inOperation | projects (props) | status | status='運維中' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |

### 5. AdministrativeSection
| 指標名稱 | 檔案路徑 | 元件/函式 | 資料表 | 欄位 | 條件 | 排除 archived/deleted | 風險註記 |
|----------|----------|-----------|--------|------|------|----------------------|----------|
| 送審中 | src/components/dashboard/AdministrativeSection.tsx | kpis.submitting | projects (props) | status | status IN ('台電送件','能源署送件') AND status NOT IN ('暫停','取消') | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 待補件 | 同上 | kpis.pendingFix | projects (props) | status | status='台電審查' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 已備案 | 同上 | kpis.approved | projects (props) | status | status='同意備案' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 待掛表 | 同上 | kpis.pendingMeter | projects (props) | status | status='報竣掛表' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 行政卡關清單 | 同上 | stuckProjects | projects (props) | updated_at | updated_at < (now-14days) AND status NOT IN ('暫停','取消','運維中') | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |

### 6. EngineeringSection
| 指標名稱 | 檔案路徑 | 元件/函式 | 資料表 | 欄位 | 條件 | 排除 archived/deleted | 風險註記 |
|----------|----------|-----------|--------|------|------|----------------------|----------|
| 尚未開工 | src/components/dashboard/EngineeringSection.tsx | kpis.notStarted | projects (props) | construction_status | construction_status='尚未開工' OR NULL | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 已開工 | 同上 | kpis.started | projects (props) | construction_status | construction_status='已開工' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 待掛錶 | 同上 | kpis.pendingMeter | projects (props) | construction_status | construction_status='待掛錶' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |
| 已掛錶 | 同上 | kpis.completed | projects (props) | construction_status | construction_status='已掛錶' | Dashboard 已過濾 | ⚠️ 用中文 label 當 key |

### 7. RiskSection
| 指標名稱 | 檔案路徑 | 元件/函式 | 資料表 | 欄位 | 條件 | 排除 archived/deleted | 風險註記 |
|----------|----------|-----------|--------|------|------|----------------------|----------|
| 高風險數 | src/components/dashboard/RiskSection.tsx | riskStats.high | projects (props) | 多欄位計算 | riskScore >= 60 | Dashboard 已過濾 | ⚠️ 本地風險計算邏輯 |
| 中風險數 | 同上 | riskStats.medium | projects (props) | 多欄位計算 | riskScore >= 30 AND < 60 | Dashboard 已過濾 | ⚠️ 本地風險計算邏輯 |
| 低風險數 | 同上 | riskStats.low | projects (props) | 多欄位計算 | riskScore > 0 AND < 30 | Dashboard 已過濾 | ⚠️ 本地風險計算邏輯 |

### 8. StatusDistributionChart
| 指標名稱 | 檔案路徑 | 元件/函式 | 資料表 | 欄位 | 條件 | 排除 archived/deleted | 風險註記 |
|----------|----------|-----------|--------|------|------|----------------------|----------|
| 案場狀態分佈 | src/hooks/useProjectAnalytics.ts | useAnalyticsSummary() | project_analytics_view | current_project_status | GROUP BY current_project_status | view 已排除 | ✅ 安全 |
| 施工狀態分佈 | 同上 | useAnalyticsSummary() | project_analytics_view | construction_status | GROUP BY construction_status | view 已排除 | ✅ 安全 |

---

## 風險總結

### 主要風險
1. **硬編碼中文狀態值**: 多處使用中文 label 作為篩選條件，若 system_options 變更將導致數據不一致
2. **財務數據未過濾**: project_payments 查詢未關聯到 projects.is_deleted，可能包含已刪除專案的付款記錄
3. **本地風險計算**: RiskSection 的風險計算邏輯與 project_analytics_view 的 has_risk 可能不一致

### 安全區域
1. project_analytics_view 的指標 (總案場數、平均進度、狀態分佈) 已在 view 層排除 is_deleted
2. Dashboard 層已過濾 is_deleted=false 的專案資料

---

## 稽核頁面入口
開發環境可訪問: `/dev/dashboard-audit`
