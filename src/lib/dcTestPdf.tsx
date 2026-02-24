import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

Font.register({ family: 'NotoSansTC', src: '/fonts/NotoSansTC-Regular.ttf' });

export interface DcTestRow {
  stringId: string;
  moduleCount: number;
  expectedVoc: number;
  measuredVoc: number;
  result: 'pass' | 'fail' | '';
  note: string;
}

export interface DcTestData {
  projectName: string;
  siteLocation: string;
  inverterModel: string;
  inverterId: string;
  testDate: string;
  testerName: string;
  weatherCondition: string;
  ambientTemp: string;
  irradiance: string;
  rows: DcTestRow[];
  reviewerName: string;
  note: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '　　年　　月　　日';
  const d = new Date(dateStr);
  return `${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
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

const COL_WIDTHS = ['8%', '18%', '14%', '16%', '16%', '10%', '18%'];

function DcTestDocument({ data }: { data: DcTestData }) {
  const passCount = data.rows.filter(r => r.result === 'pass').length;
  const failCount = data.rows.filter(r => r.result === 'fail').length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>表 3-3：DC 開路電壓測試自主檢查表</Text>

        {/* Header info */}
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>工程名稱：</Text>
          <Text style={s.infoValue}>{data.projectName}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>逆變器型號：</Text><Text style={s.infoValue}>{data.inverterModel}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>逆變器編號：</Text><Text style={s.infoValue}>{data.inverterId}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>測試日期：</Text><Text style={s.infoValue}>{formatDate(data.testDate)}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>測試人員：</Text><Text style={s.infoValue}>{data.testerName}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>天氣狀況：</Text><Text style={s.infoValue}>{data.weatherCondition}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>環境溫度：</Text><Text style={s.infoValue}>{data.ambientTemp}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>日射量：</Text><Text style={s.infoValue}>{data.irradiance}</Text></View>
        </View>

        {/* Data table */}
        <View style={s.table}>
          <View style={s.tRow}>
            {['序號', '串列編號', '模組數量', '理論 Voc (V)', '實測 Voc (V)', '判定', '備註'].map((h, i) => (
              <View key={h} style={[s.th, { width: COL_WIDTHS[i] }, i === 6 ? { borderRightWidth: 0 } : {}]}>
                <Text style={s.thText}>{h}</Text>
              </View>
            ))}
          </View>
          {data.rows.map((row, idx) => (
            <View key={idx} style={[s.tRow, idx === data.rows.length - 1 ? { borderBottomWidth: 0 } : {}]}>
              <View style={[s.td, { width: COL_WIDTHS[0] }]}><Text style={s.tdText}>{idx + 1}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[1] }]}><Text style={s.tdText}>{row.stringId}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[2] }]}><Text style={s.tdText}>{row.moduleCount || ''}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[3] }]}><Text style={s.tdText}>{row.expectedVoc || ''}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[4] }]}><Text style={s.tdText}>{row.measuredVoc || ''}</Text></View>
              <View style={[s.td, { width: COL_WIDTHS[5] }]}>
                <Text style={row.result === 'pass' ? s.passText : row.result === 'fail' ? s.failText : s.tdText}>
                  {row.result === 'pass' ? '合格' : row.result === 'fail' ? '不合格' : ''}
                </Text>
              </View>
              <View style={[s.td, { width: COL_WIDTHS[6], borderRightWidth: 0 }]}><Text style={s.tdText}>{row.note}</Text></View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={{ flexDirection: 'row', marginTop: 6, gap: 16 }}>
          <Text style={{ fontSize: 8 }}>測試串列數：{data.rows.length}</Text>
          <Text style={{ fontSize: 8 }}>合格：{passCount}</Text>
          <Text style={{ fontSize: 8 }}>不合格：{failCount}</Text>
        </View>
        {data.note ? <View style={{ marginTop: 4 }}><Text style={{ fontSize: 7 }}>備註：{data.note}</Text></View> : null}

        {/* Signatures */}
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

export async function generateDcTestPdf(data: DcTestData) {
  const blob = await pdf(<DcTestDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `DC測試_${data.projectName || '未命名'}_${data.testDate || new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
