import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

Font.register({ family: 'NotoSansTC', src: '/fonts/NotoSansTC-Regular.ttf' });

export interface InspectionItem {
  id: string;
  label: string;
  result: 'normal' | 'abnormal' | '';
  note: string;
}

export interface InspectionSection {
  id: string;
  title: string;
  items: InspectionItem[];
}

export interface InspectionData {
  projectName: string;
  siteLocation: string;
  capacityKw: string;
  inspectionDate: string;
  inspectionType: 'monthly' | 'quarterly' | 'annual';
  inspectorName: string;
  weatherCondition: string;
  ambientTemp: string;
  sections: InspectionSection[];
  overallNote: string;
  reviewerName: string;
}

export const DEFAULT_SECTIONS: InspectionSection[] = [
  {
    id: 'pv_module', title: '一、太陽能模組',
    items: [
      { id: 'pv1', label: '模組表面清潔狀況', result: '', note: '' },
      { id: 'pv2', label: '模組表面有無破損/裂痕', result: '', note: '' },
      { id: 'pv3', label: '模組框架有無變形/鏽蝕', result: '', note: '' },
      { id: 'pv4', label: '模組接線盒有無燒毀/變色', result: '', note: '' },
      { id: 'pv5', label: '模組固定螺栓是否緊固', result: '', note: '' },
    ],
  },
  {
    id: 'mounting', title: '二、支架結構',
    items: [
      { id: 'mt1', label: '支架結構有無變形/傾斜', result: '', note: '' },
      { id: 'mt2', label: '支架螺栓是否緊固', result: '', note: '' },
      { id: 'mt3', label: '支架防鏽處理狀況', result: '', note: '' },
      { id: 'mt4', label: '基礎有無沉降/裂縫', result: '', note: '' },
    ],
  },
  {
    id: 'dc_wiring', title: '三、DC 端配線',
    items: [
      { id: 'dc1', label: 'DC 線路絕緣是否良好', result: '', note: '' },
      { id: 'dc2', label: 'DC 接頭（MC4）接觸是否良好', result: '', note: '' },
      { id: 'dc3', label: 'DC 線路有無破損/老化', result: '', note: '' },
      { id: 'dc4', label: 'DC 開關操作是否正常', result: '', note: '' },
    ],
  },
  {
    id: 'inverter', title: '四、逆變器',
    items: [
      { id: 'inv1', label: '逆變器運轉指示燈狀態', result: '', note: '' },
      { id: 'inv2', label: '逆變器散熱風扇運轉狀況', result: '', note: '' },
      { id: 'inv3', label: '逆變器有無異音/異味', result: '', note: '' },
      { id: 'inv4', label: '逆變器外殼有無損傷', result: '', note: '' },
      { id: 'inv5', label: '逆變器顯示數據是否正常', result: '', note: '' },
    ],
  },
  {
    id: 'ac_wiring', title: '五、AC 端配線',
    items: [
      { id: 'ac1', label: 'AC 端線路絕緣是否良好', result: '', note: '' },
      { id: 'ac2', label: 'AC 端接線端子是否緊固', result: '', note: '' },
      { id: 'ac3', label: 'AC 斷路器操作是否正常', result: '', note: '' },
    ],
  },
  {
    id: 'grounding', title: '六、接地系統',
    items: [
      { id: 'gnd1', label: '接地線連接是否良好', result: '', note: '' },
      { id: 'gnd2', label: '接地電阻值是否合格（≤10Ω）', result: '', note: '' },
      { id: 'gnd3', label: '接地端子有無鏽蝕', result: '', note: '' },
    ],
  },
  {
    id: 'lightning', title: '七、防雷系統',
    items: [
      { id: 'lt1', label: '避雷器外觀是否正常', result: '', note: '' },
      { id: 'lt2', label: '避雷器接地是否良好', result: '', note: '' },
    ],
  },
  {
    id: 'monitoring', title: '八、監控系統',
    items: [
      { id: 'mon1', label: '監控系統通訊是否正常', result: '', note: '' },
      { id: 'mon2', label: '數據擷取是否完整', result: '', note: '' },
      { id: 'mon3', label: '告警功能是否正常', result: '', note: '' },
    ],
  },
  {
    id: 'meter', title: '九、電表/計量',
    items: [
      { id: 'mtr1', label: '電表讀數記錄', result: '', note: '' },
      { id: 'mtr2', label: '電表外觀是否正常', result: '', note: '' },
      { id: 'mtr3', label: '電表封印是否完整', result: '', note: '' },
    ],
  },
  {
    id: 'environment', title: '十、環境',
    items: [
      { id: 'env1', label: '場址排水狀況', result: '', note: '' },
      { id: 'env2', label: '周邊植栽有無遮蔭', result: '', note: '' },
      { id: 'env3', label: '圍籬/門鎖是否完好', result: '', note: '' },
      { id: 'env4', label: '場區有無異物/垃圾堆積', result: '', note: '' },
    ],
  },
  {
    id: 'safety', title: '十一、安全設施',
    items: [
      { id: 'sf1', label: '警示標誌是否完好', result: '', note: '' },
      { id: 'sf2', label: '消防設備是否在有效期內', result: '', note: '' },
      { id: 'sf3', label: '急救箱是否備齊', result: '', note: '' },
      { id: 'sf4', label: '逃生路線標示是否清晰', result: '', note: '' },
    ],
  },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return '　　年　　月　　日';
  const d = new Date(dateStr);
  return `${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

const TYPE_LABELS: Record<string, string> = { monthly: '月檢', quarterly: '季檢', annual: '年檢' };

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: 'NotoSansTC', fontSize: 7 },
  title: { fontSize: 12, textAlign: 'center', fontWeight: 700, marginBottom: 8 },
  infoRow: { flexDirection: 'row', marginBottom: 1.5 },
  infoLabel: { fontWeight: 700, fontSize: 7, width: '12%' },
  infoValue: { fontSize: 7, borderBottomWidth: 0.5, borderBottomColor: '#000', flex: 1 },
  table: { borderWidth: 1, borderColor: '#000', marginTop: 4 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', minHeight: 14 },
  sectionRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', minHeight: 16, backgroundColor: '#efefef' },
  th: { backgroundColor: '#ddd', padding: 2, borderRightWidth: 0.5, borderRightColor: '#000', justifyContent: 'center', alignItems: 'center' },
  td: { padding: 2, borderRightWidth: 0.5, borderRightColor: '#000', justifyContent: 'center', alignItems: 'center' },
  thText: { fontSize: 6.5, fontWeight: 700, textAlign: 'center' },
  tdText: { fontSize: 6.5, textAlign: 'center' },
  sectionText: { fontSize: 7, fontWeight: 700, padding: 2 },
  normalText: { fontSize: 6.5, color: '#16a34a', textAlign: 'center' },
  abnormalText: { fontSize: 6.5, color: '#dc2626', textAlign: 'center' },
  sigArea: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  sigBlock: { width: '30%', alignItems: 'center' },
  sigLine: { borderBottomWidth: 0.5, borderBottomColor: '#000', width: '100%', marginTop: 22, marginBottom: 2 },
  sigLabel: { fontSize: 7, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 12, left: 28, right: 28, fontSize: 5.5, color: '#999', textAlign: 'center' },
});

const COL_W = ['6%', '40%', '12%', '42%'];

function InspectionDocument({ data }: { data: InspectionData }) {
  const totalItems = data.sections.reduce((sum, sec) => sum + sec.items.length, 0);
  const normalCount = data.sections.reduce((sum, sec) => sum + sec.items.filter(i => i.result === 'normal').length, 0);
  const abnormalCount = data.sections.reduce((sum, sec) => sum + sec.items.filter(i => i.result === 'abnormal').length, 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>表 3-2：太陽光電系統維護保養檢查表</Text>

        <View style={s.infoRow}><Text style={s.infoLabel}>工程名稱：</Text><Text style={s.infoValue}>{data.projectName}</Text></View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 1.5 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>電廠地點：</Text><Text style={s.infoValue}>{data.siteLocation}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>裝置容量：</Text><Text style={s.infoValue}>{data.capacityKw} kW</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 1.5 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>巡檢日期：</Text><Text style={s.infoValue}>{formatDate(data.inspectionDate)}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>巡檢類型：</Text><Text style={s.infoValue}>{TYPE_LABELS[data.inspectionType] || data.inspectionType}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>巡檢人員：</Text><Text style={s.infoValue}>{data.inspectorName}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 1.5 }}>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>天氣狀況：</Text><Text style={s.infoValue}>{data.weatherCondition}</Text></View>
          <View style={[s.infoRow, { flex: 1 }]}><Text style={s.infoLabel}>環境溫度：</Text><Text style={s.infoValue}>{data.ambientTemp}</Text></View>
        </View>

        <View style={s.table}>
          {/* Header */}
          <View style={s.tRow}>
            {['序號', '檢查項目', '結果', '備註/異常說明'].map((h, i) => (
              <View key={h} style={[s.th, { width: COL_W[i] }, i === 3 ? { borderRightWidth: 0 } : {}]}>
                <Text style={s.thText}>{h}</Text>
              </View>
            ))}
          </View>

          {data.sections.map((sec) => (
            <View key={sec.id}>
              {/* Section header */}
              <View style={s.sectionRow}>
                <View style={{ width: '100%', padding: 2 }}><Text style={s.sectionText}>{sec.title}</Text></View>
              </View>
              {sec.items.map((item, idx) => (
                <View key={item.id} style={[s.tRow, idx === sec.items.length - 1 ? {} : {}]}>
                  <View style={[s.td, { width: COL_W[0] }]}><Text style={s.tdText}>{item.id}</Text></View>
                  <View style={[s.td, { width: COL_W[1], alignItems: 'flex-start' }]}><Text style={[s.tdText, { textAlign: 'left' }]}>{item.label}</Text></View>
                  <View style={[s.td, { width: COL_W[2] }]}>
                    <Text style={item.result === 'normal' ? s.normalText : item.result === 'abnormal' ? s.abnormalText : s.tdText}>
                      {item.result === 'normal' ? '正常' : item.result === 'abnormal' ? '異常' : ''}
                    </Text>
                  </View>
                  <View style={[s.td, { width: COL_W[3], borderRightWidth: 0, alignItems: 'flex-start' }]}><Text style={[s.tdText, { textAlign: 'left' }]}>{item.note}</Text></View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={{ flexDirection: 'row', marginTop: 4, gap: 12 }}>
          <Text style={{ fontSize: 7 }}>總檢查項：{totalItems}</Text>
          <Text style={{ fontSize: 7, color: '#16a34a' }}>正常：{normalCount}</Text>
          <Text style={{ fontSize: 7, color: '#dc2626' }}>異常：{abnormalCount}</Text>
          <Text style={{ fontSize: 7 }}>未檢：{totalItems - normalCount - abnormalCount}</Text>
        </View>
        {data.overallNote ? <View style={{ marginTop: 3 }}><Text style={{ fontSize: 6.5 }}>總體備註：{data.overallNote}</Text></View> : null}

        <View style={s.sigArea}>
          <View style={s.sigBlock}><Text style={s.sigLabel}>巡檢人員</Text><View style={s.sigLine} /><Text style={{ fontSize: 6.5 }}>{data.inspectorName}</Text></View>
          <View style={s.sigBlock}><Text style={s.sigLabel}>現場負責人</Text><View style={s.sigLine} /></View>
          <View style={s.sigBlock}><Text style={s.sigLabel}>審核人</Text><View style={s.sigLine} /><Text style={{ fontSize: 6.5 }}>{data.reviewerName}</Text></View>
        </View>

        <Text style={s.footer}>維護保養暨系統效能保證合約</Text>
      </Page>
    </Document>
  );
}

export async function generateInspectionPdf(data: InspectionData) {
  const blob = await pdf(<InspectionDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `巡檢紀錄_${data.projectName || '未命名'}_${data.inspectionDate || new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
