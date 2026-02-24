import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansTC',
  src: '/fonts/NotoSansTC-Regular.ttf',
});

export interface IncidentReportData {
  projectName: string;
  siteLocation: string;
  reportNumber: string;
  reportDate: string;
  reporterName: string;
  reporterPhone: string;
  incidentDate: string;
  incidentTime: string;
  discoveredBy: string;
  categories: string[];
  otherCategory: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  incidentDescription: string;
  immediateAction: string;
  arrivalDate: string;
  arrivalTime: string;
  repairDate: string;
  repairTime: string;
  repairDescription: string;
  repairResult: string;
  preventiveMeasures: string;
  affectedCapacityKw: number;
  estimatedLossKwh: number;
  partsReplaced: string;
  reviewerName: string;
  reviewerTitle: string;
  status: 'open' | 'resolved' | 'closed';
  note: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '　　年　　月　　日';
  const d = new Date(dateStr);
  const y = d.getFullYear() - 1911;
  return `${y} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

const SEVERITY_MAP: Record<string, string> = {
  low: '輕微', medium: '中度', high: '嚴重', critical: '緊急',
};
const STATUS_MAP: Record<string, string> = {
  open: '處理中', resolved: '已修復', closed: '已結案',
};

const INCIDENT_CATEGORIES = [
  '模組異常', '逆變器異常', '線路異常', '結構異常',
  '監控系統異常', '接地異常', '環境因素', '其他',
];

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'NotoSansTC', fontSize: 9 },
  title: { fontSize: 14, textAlign: 'center', fontWeight: 700, marginBottom: 14 },
  table: { borderWidth: 1, borderColor: '#000' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', minHeight: 22 },
  labelCell: { width: '20%', backgroundColor: '#f5f5f5', padding: 4, borderRightWidth: 0.5, borderRightColor: '#000', justifyContent: 'center' },
  valueCell: { flex: 1, padding: 4, justifyContent: 'center' },
  valueCellHalf: { width: '30%', padding: 4, borderRightWidth: 0.5, borderRightColor: '#000', justifyContent: 'center' },
  labelText: { fontSize: 8, fontWeight: 700 },
  valueText: { fontSize: 8 },
  sectionHeader: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', minHeight: 20, backgroundColor: '#e8e8e8' },
  sectionHeaderText: { fontSize: 9, fontWeight: 700, padding: 4 },
  checkbox: { width: 7, height: 7, borderWidth: 0.5, borderColor: '#000', marginRight: 2, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { width: 7, height: 7, borderWidth: 0.5, borderColor: '#000', marginRight: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  checkMark: { color: '#fff', fontSize: 5, fontWeight: 700 },
  checkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  checkItem: { flexDirection: 'row', alignItems: 'center', marginRight: 6 },
  checkLabel: { fontSize: 7 },
  signatureArea: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBlock: { width: '30%', alignItems: 'center' },
  signatureLine: { borderBottomWidth: 0.5, borderBottomColor: '#000', width: '100%', marginTop: 28, marginBottom: 4 },
  signatureLabel: { fontSize: 8, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 15, left: 36, right: 36, fontSize: 6, color: '#999', textAlign: 'center' },
});

function CB({ checked }: { checked: boolean }) {
  return (
    <View style={checked ? s.checkboxChecked : s.checkbox}>
      {checked && <Text style={s.checkMark}>✓</Text>}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.row}>
      <View style={s.labelCell}><Text style={s.labelText}>{label}</Text></View>
      <View style={s.valueCell}><Text style={s.valueText}>{children}</Text></View>
    </View>
  );
}

function TwoColRow({ label1, value1, label2, value2 }: { label1: string; value1: string; label2: string; value2: string }) {
  return (
    <View style={s.row}>
      <View style={s.labelCell}><Text style={s.labelText}>{label1}</Text></View>
      <View style={s.valueCellHalf}><Text style={s.valueText}>{value1}</Text></View>
      <View style={[s.labelCell, { width: '16%' }]}><Text style={s.labelText}>{label2}</Text></View>
      <View style={s.valueCell}><Text style={s.valueText}>{value2}</Text></View>
    </View>
  );
}

function WideRow({ label, children, minHeight }: { label: string; children: React.ReactNode; minHeight?: number }) {
  return (
    <View style={[s.row, minHeight ? { minHeight } : {}]}>
      <View style={s.labelCell}><Text style={s.labelText}>{label}</Text></View>
      <View style={[s.valueCell, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }]}>
        {children}
      </View>
    </View>
  );
}

function IncidentReportDocument({ data }: { data: IncidentReportData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>表 3-6：電廠異常處理單</Text>

        <View style={s.table}>
          {/* Section 1: Report Info */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>壹、通報資訊</Text>
          </View>
          <Row label="工程名稱">{data.projectName}</Row>
          <TwoColRow label1="電廠地點" value1={data.siteLocation} label2="通報單號" value2={data.reportNumber} />
          <TwoColRow label1="通報日期" value1={formatDate(data.reportDate)} label2="通報人" value2={`${data.reporterName}${data.reporterPhone ? ` / ${data.reporterPhone}` : ''}`} />

          {/* Section 2: Incident */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>貳、異常狀況</Text>
          </View>
          <TwoColRow label1="發生日期" value1={formatDate(data.incidentDate)} label2="發生時間" value2={data.incidentTime || '　　:　　'} />
          <TwoColRow label1="發現人" value1={data.discoveredBy} label2="嚴重程度" value2={SEVERITY_MAP[data.severity] || data.severity} />

          {/* Categories with checkboxes */}
          <WideRow label="異常類別">
            <View style={s.checkRow}>
              {INCIDENT_CATEGORIES.map((cat) => (
                <View key={cat} style={s.checkItem}>
                  <CB checked={data.categories.includes(cat)} />
                  <Text style={s.checkLabel}>{cat === '其他' && data.otherCategory ? `其他：${data.otherCategory}` : cat}</Text>
                </View>
              ))}
            </View>
          </WideRow>

          <Row label="異常描述">{data.incidentDescription}</Row>
          <Row label="即時處置">{data.immediateAction}</Row>

          {/* Section 3: Response */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>參、到場與修復追蹤</Text>
          </View>
          <TwoColRow label1="到場日期" value1={formatDate(data.arrivalDate)} label2="到場時間" value2={data.arrivalTime || '　　:　　'} />
          <TwoColRow label1="修復日期" value1={formatDate(data.repairDate)} label2="修復時間" value2={data.repairTime || '　　:　　'} />
          <Row label="修復內容">{data.repairDescription}</Row>
          <Row label="修復結果">{data.repairResult}</Row>
          <Row label="預防措施">{data.preventiveMeasures}</Row>

          {/* Section 4: Impact */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>肆、影響評估</Text>
          </View>
          <TwoColRow label1="受影響容量" value1={`${data.affectedCapacityKw} kW`} label2="估計損失" value2={`${data.estimatedLossKwh} kWh`} />
          <Row label="更換零件">{data.partsReplaced}</Row>

          {/* Section 5: Review */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>伍、結案</Text>
          </View>
          <TwoColRow label1="處理狀態" value1={STATUS_MAP[data.status] || data.status} label2="審核人" value2={`${data.reviewerName}${data.reviewerTitle ? ` / ${data.reviewerTitle}` : ''}`} />
          <Row label="備註">{data.note}</Row>
        </View>

        {/* Signatures */}
        <View style={s.signatureArea}>
          <View style={s.signatureBlock}>
            <Text style={s.signatureLabel}>通報人</Text>
            <View style={s.signatureLine} />
            <Text style={{ fontSize: 7 }}>{data.reporterName}</Text>
          </View>
          <View style={s.signatureBlock}>
            <Text style={s.signatureLabel}>現場負責人</Text>
            <View style={s.signatureLine} />
          </View>
          <View style={s.signatureBlock}>
            <Text style={s.signatureLabel}>審核人</Text>
            <View style={s.signatureLine} />
            <Text style={{ fontSize: 7 }}>{data.reviewerName}</Text>
          </View>
        </View>

        <Text style={s.footer}>維護保養暨系統效能保證合約</Text>
      </Page>
    </Document>
  );
}

export async function generateIncidentReportPdf(data: IncidentReportData) {
  const blob = await pdf(<IncidentReportDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = data.reportDate || new Date().toISOString().slice(0, 10);
  link.download = `異常處理單_${data.projectName || '未命名'}_${dateStr}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
