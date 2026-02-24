import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

Font.register({ family: 'NotoSansTC', src: '/fonts/NotoSansTC-Regular.ttf' });

export interface AcTestRow {
  itemId: string;
  testItem: string;
  standard: string;
  measuredValue: string;
  result: 'pass' | 'fail' | '';
  note: string;
}

export interface AcTestData {
  projectName: string;
  siteLocation: string;
  inverterModel: string;
  inverterId: string;
  testDate: string;
  testerName: string;
  meterNumber: string;
  gridVoltage: string;
  gridFrequency: string;
  rows: AcTestRow[];
  reviewerName: string;
  note: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '　　年　　月　　日';
  const d = new Date(dateStr);
  return `${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

const DEFAULT_AC_ITEMS: Omit<AcTestRow, 'measuredValue' | 'result' | 'note'>[] = [
  { itemId: '1', testItem: 'R-S 線電壓 (V)', standard: '380V ± 10%' },
  { itemId: '2', testItem: 'S-T 線電壓 (V)', standard: '380V ± 10%' },
  { itemId: '3', testItem: 'T-R 線電壓 (V)', standard: '380V ± 10%' },
  { itemId: '4', testItem: 'R 相電流 (A)', standard: '額定值內' },
  { itemId: '5', testItem: 'S 相電流 (A)', standard: '額定值內' },
  { itemId: '6', testItem: 'T 相電流 (A)', standard: '額定值內' },
  { itemId: '7', testItem: '頻率 (Hz)', standard: '60Hz ± 0.5' },
  { itemId: '8', testItem: '功率因數 (PF)', standard: '≥ 0.95' },
  { itemId: '9', testItem: '接地電阻 (Ω)', standard: '≤ 10Ω' },
  { itemId: '10', testItem: '絕緣電阻 (MΩ)', standard: '≥ 1MΩ' },
];

export function getDefaultAcRows(): AcTestRow[] {
  return DEFAULT_AC_ITEMS.map(item => ({ ...item, measuredValue: '', result: '', note: '' }));
}

const s = StyleSheet.create({
  page: { padding: 30, fontFamily: 'NotoSansTC', fontSize: 8 },
  title: { fontSize: 13, textAlign: 'center', fontWeight: 700, marginBottom: 10 },
  infoRow: { flexDirection: 'row', marginBottom: 2 },
  infoLabel: { fontWeight: 700, fontSize: 8, width: '14%' },
  infoValue: { fontSize: 8, borderBottomWidth: 0.5, borderBottomColor: '#000', flex: 1 },
  table: { borderWidth: 1, borderColor: '#000', marginTop: 8 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', minHeight: 18 },
  th: { backgroundColor: '#e8e8e8', padding: 3, borderRightWidth: 0.5, borderRightColor: '#000', justifyContent: 'center', alignItems: 'center' },
  td: { padding: 3, borderRightWidth: 0.5, borderRightColor: '#000', justifyContent: 'center', alignItems: 'center' },
  thText: { fontSize: 7, fontWeight: 700, textAlign: 'center' },
  tdText: { fontSize: 7, textAlign: 'center' },
  passText: { fontSize: 7, textAlign: 'center', color: '#16a34a' },
  failText: { fontSize: 7, textAlign: 'center', color: '#dc2626' },
  signatureArea: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between' },
  sigBlock: { width: '30%', alignItems: 'center' },
  sigLine: { borderBottomWidth: 0.5, borderBottomColor: '#000', width: '100%', marginTop: 26, marginBottom: 3 },
  sigLabel: { fontSize: 8, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 14, left: 30, right: 30, fontSize: 6, color: '#999', textAlign: 'center' },
});

const COL_WIDTHS = ['7%', '20%', '18%', '16%', '10%', '29%'];

function AcTestDocument({ data }: { data: AcTestData }) {
  const passCount = data.rows.filter(r => r.result === 'pass').length;
  const failCount = data.rows.filter(r => r.result === 'fail').length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>表 3-4：AC 測試自主檢查表</Text>

        <View style={s.infoRow}><Text style={s.infoLabel}>工程名稱：</Text><Text style={s.infoValue}>{data.projectName}</Text></View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>逆變器型號：</Text><Text style={s.infoValue}>{data.inverterModel}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>逆變器編號：</Text><Text style={s.infoValue}>{data.inverterId}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>測試日期：</Text><Text style={s.infoValue}>{formatDate(data.testDate)}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>測試人員：</Text><Text style={s.infoValue}>{data.testerName}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>電表號碼：</Text><Text style={s.infoValue}>{data.meterNumber}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>市電電壓：</Text><Text style={s.infoValue}>{data.gridVoltage}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>市電頻率：</Text><Text style={s.infoValue}>{data.gridFrequency}</Text></View>
        </View>

        <View style={s.table}>
          <View style={s.tRow}>
            {['序號', '測試項目', '標準值', '實測值', '判定', '備註'].map((h, i) => (
              <View key={h} style={[s.th, { width: COL_WIDTHS[i] }, i === 5 ? { borderRightWidth: 0 } : {}]}>
                <Text style={s.thText}>{h}</Text>
              </View>
            ))}
          </View>
          {data.rows.map((row, idx) => (
            <View key={idx} style={[s.tRow, idx === data.rows.length - 1 ? { borderBottomWidth: 0 } : {}]}>
              <View style={[s.td, { width: COL_WIDTHS[0] }]}><Text style={s.tdText}>{row.itemId}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[1] }]}><Text style={[s.tdText, { textAlign: 'left' }]}>{row.testItem}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[2] }]}><Text style={s.tdText}>{row.standard}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[3] }]}><Text style={s.tdText}>{row.measuredValue}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[4] }]}>
                <Text style={row.result === 'pass' ? s.passText : row.result === 'fail' ? s.failText : s.tdText}>
                  {row.result === 'pass' ? '合格' : row.result === 'fail' ? '不合格' : ''}
                </Text>
              </View>
              <View style={[s.td, { width: COL_WIDTHS[5], borderRightWidth: 0 }]}><Text style={s.tdText}>{row.note}</Text></View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 6, gap: 16 }}>
          <Text style={{ fontSize: 8 }}>測試項目數：{data.rows.length}</Text>
          <Text style={{ fontSize: 8 }}>合格：{passCount}</Text>
          <Text style={{ fontSize: 8 }}>不合格：{failCount}</Text>
        </View>
        {data.note ? <View style={{ marginTop: 4 }}><Text style={{ fontSize: 7 }}>備註：{data.note}</Text></View> : null}

        <View style={s.signatureArea}>
          <View style={s.sigBlock}><Text style={s.sigLabel}>測試人員</Text><View style={s.sigLine} /><Text style={{ fontSize: 7 }}>{data.testerName}</Text></View>
          <View style={s.sigBlock}><Text style={s.sigLabel}>現場負責人</Text><View style={s.sigLine} /></View>
          <View style={s.sigBlock}><Text style={s.sigLabel}>審核人</Text><View style={s.sigLine} /><Text style={{ fontSize: 7 }}>{data.reviewerName}</Text></View>
        </View>

        <Text style={s.footer}>維護保養暨系統效能保證合約</Text>
      </Page>
    </Document>
  );
}

export async function generateAcTestPdf(data: AcTestData) {
  const blob = await pdf(<AcTestDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AC測試_${data.projectName || '未命名'}_${data.testDate || new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
