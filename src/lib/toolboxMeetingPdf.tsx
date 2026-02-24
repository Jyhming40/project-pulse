import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansTC',
  src: '/fonts/NotoSansTC-Regular.ttf',
});

export interface ToolboxMeetingData {
  projectName: string;
  contractor: string;
  subContractor: string;
  notifyDate: string;
  workLocation: string;
  workDescription: string;
  selectedWorkLocations: string[];
  selectedWorkTypes: string[];
  selectedHazards: string[];
  otherHazard: string;
  otherNotes: string;
  attendees: string[];
  supervisorName: string;
}

const SAFETY_PLEDGES = [
  '進入工地穿戴適當安全帽、安全鞋、護目鏡、識別背心及安全衛生法規規定之防護器具。',
  '工作前、工作中絕不飲用酒精性飲料，不得於非指定吸煙區吸煙及食用檳榔。',
  '出入廠區均應聽從出入口警衛管制及盤查，物品攜出須有物品攜出放行單。',
  '作業中聽到緊急警告聲時應立即疏散至安全集合地點避難並接受點名。',
  '高度 2 公尺以上之高架作業需全程使用背負式安全帶。',
  '臨時用電設備會置放滅火器，並檢查壓力表及有效期間。',
  '使用合梯的構造應堅固且與地面角度 75 度以內，兩梯腳間有繫材扣牢。作業時應跨坐，不得站立或側立作業。',
  '使用切割機時會先檢查切割機械之防護罩。',
  '未經主管許可，絕不跨越護欄及警示帶。',
  '會將用電設備接在規定的電源插座上，絕不私自亂接。',
  '未經主管許可，絕不拆除護欄、護蓋、安全網、安全母索、警示帶、施工架踏板、漏電斷路器、自動電擊防止裝置等安全防護裝置或使其失去功能。',
];

const WORK_LOCATIONS = ['市區', '住宅', '養殖屋舍', '房舍屋頂'];
const WORK_TYPES = ['屋頂作業', '接近活線作業', '電纜鋪設作業', '吊掛作業'];
const HAZARD_FACTORS = [
  '感電灼傷危險', '刺傷危險', '絆倒危險', '墜落危險',
  '滑倒危險', '撞擊擦傷危險', '被夾壓、衝擊', '第三人遭受意外之危險',
];

const SAFETY_MEASURES = [
  '作業前工作場所負責人應向工作人員作詳細之工作說明，告知危害因素，採取防範對策。',
  '禁止在上工前或工作中喝飲如酒類不當飲料，倘有身體不適，應事先告知工作場所負責人。',
  '接近活電工作應先行斷電並確實檢電、掛接地線，於碰觸設備導體之前，仍應自行再檢電確認。',
  '無法與活線保持安全距離者，應採取絕緣掩蔽及使用妥善安全護具。',
  '移動工作位置時，應先觀察周圍、並做妥安全措施。',
  '注意開關切開或跳脫後其電源側或負載側是否仍有電。',
  '接近活線之工作必須派人從旁監護。',
  '必要時需設置工作台，安全護欄踏板要綁牢。',
  '登上石棉瓦（或塑膠浪板）屋頂應先鋪設踏板。',
  '應使用工具袋，利用繩索升降，不可隨處拋擲物件。',
  '重件吊運至高處要設專人指揮連絡，人員不可站於吊掛物掉落位置之地點。',
  '二公尺以上高架作業或有墜落危險之高處工作應使用安全帶及補助繩。',
  '高血壓、心臟血管疾病、貧血者、當日上工身體不適者，不宜從事高架作業。',
  '安全護具、工具、車輛機械、設備材料，作業前需實施自動檢查及確實檢點。',
  '進入有物體掉落之地區應做好防護措施，禁止穿拖鞋、打赤腳等人員進入工作區域。',
  '多層作業之施工區域，應指派專人監視，對於容易墜落之小鐵塊、螺絲帽、零件等應防止掉落傷人。',
  '強風、豪雨、打雷、閃電等天候不佳時，應暫停所有室外之作業。',
  '臨時施工用電開關箱電源側，應有漏電斷路裝置。',
  '工作場所應隨時整頓整理清潔。',
  '其他未規定事項者，悉依勞安衛生規範規定執行。',
];

const s = StyleSheet.create({
  page: { padding: 30, fontFamily: 'NotoSansTC', fontSize: 8 },
  title: { fontSize: 12, textAlign: 'center', marginBottom: 10, fontWeight: 700 },
  headerRow: { flexDirection: 'row', marginBottom: 2 },
  headerLabel: { fontWeight: 700, fontSize: 8, width: '15%' },
  headerValue: { fontSize: 8, borderBottomWidth: 0.5, borderBottomColor: '#000', flex: 1 },
  sectionTitle: { fontSize: 8, fontWeight: 700, marginTop: 8, marginBottom: 3 },
  pledgeItem: { flexDirection: 'row', marginBottom: 1.5 },
  pledgeNum: { width: '5%', fontSize: 7 },
  pledgeText: { flex: 1, fontSize: 7 },
  checkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  checkItem: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  checkbox: { width: 8, height: 8, borderWidth: 0.5, borderColor: '#000', marginRight: 3, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { width: 8, height: 8, borderWidth: 0.5, borderColor: '#000', marginRight: 3, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  checkMark: { color: '#fff', fontSize: 5, fontWeight: 700 },
  checkLabel: { fontSize: 7 },
  bulletItem: { flexDirection: 'row', marginBottom: 1 },
  bullet: { width: '3%', fontSize: 7 },
  bulletText: { flex: 1, fontSize: 7 },
  signatureSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#000', paddingTop: 6 },
  signatureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  signatureBox: { width: '23%', borderBottomWidth: 0.5, borderBottomColor: '#000', paddingBottom: 2, marginBottom: 4, fontSize: 7, minHeight: 16 },
  supervisorRow: { flexDirection: 'row', marginTop: 8 },
  footer: { position: 'absolute', bottom: 15, left: 30, right: 30, fontSize: 6, color: '#999', textAlign: 'center' },
});

function CB({ checked }: { checked: boolean }) {
  return (
    <View style={checked ? s.checkboxChecked : s.checkbox}>
      {checked && <Text style={s.checkMark}>✓</Text>}
    </View>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '　　年　　月　　日';
  const d = new Date(dateStr);
  const y = d.getFullYear() - 1911;
  return `${y} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function ToolboxMeetingDocument({ data }: { data: ToolboxMeetingData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>表 3-9：每日工具箱會議紀錄表及每日勤前教育暨危害告知單</Text>

        {/* Header info */}
        <View style={s.headerRow}>
          <Text style={s.headerLabel}>工程名稱：</Text>
          <Text style={s.headerValue}>{data.projectName}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 2 }}>
          <View style={[s.headerRow, { flex: 1 }]}>
            <Text style={s.headerLabel}>承攬商：</Text>
            <Text style={s.headerValue}>{data.contractor}</Text>
          </View>
          <View style={[s.headerRow, { flex: 1 }]}>
            <Text style={s.headerLabel}>（次）承攬商：</Text>
            <Text style={s.headerValue}>{data.subContractor}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 2 }}>
          <View style={[s.headerRow, { flex: 1 }]}>
            <Text style={s.headerLabel}>告知日期：</Text>
            <Text style={s.headerValue}>{formatDate(data.notifyDate)}</Text>
          </View>
          <View style={[s.headerRow, { flex: 1 }]}>
            <Text style={s.headerLabel}>作業位置：</Text>
            <Text style={s.headerValue}>{data.workLocation}</Text>
          </View>
        </View>
        <View style={s.headerRow}>
          <Text style={s.headerLabel}>作業描述：</Text>
          <Text style={s.headerValue}>{data.workDescription}</Text>
        </View>

        {/* Pledges */}
        <Text style={{ fontSize: 7, marginTop: 6, marginBottom: 4 }}>
          本人承諾遵守下列事項，若有違反，依規定辦理，絕無異議。
        </Text>
        {SAFETY_PLEDGES.map((pledge, i) => (
          <View key={i} style={s.pledgeItem}>
            <Text style={s.pledgeNum}>{i + 1}.</Text>
            <Text style={s.pledgeText}>{pledge}</Text>
          </View>
        ))}

        {/* Other notes */}
        <Text style={s.sectionTitle}>其他注意事項（請依當日施工重點、特殊作業或氣候等加強宣導）</Text>
        <Text style={{ fontSize: 7, marginBottom: 4, minHeight: 20 }}>{data.otherNotes || ' '}</Text>

        <Text style={{ fontSize: 7, marginBottom: 6 }}>
          本人已完全了解安全衛生教育相關事項，並願意完全遵守。若有違者，願依規定罰則接受處罰。
        </Text>

        {/* Section 1: Work environment */}
        <Text style={s.sectionTitle}>一、工作場所環境：</Text>
        <View style={{ marginLeft: 10, marginBottom: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Text style={{ fontSize: 7, width: '15%' }}>1. 工作地點：</Text>
            <View style={s.checkRow}>
              {WORK_LOCATIONS.map((loc) => (
                <View key={loc} style={s.checkItem}>
                  <CB checked={data.selectedWorkLocations.includes(loc)} />
                  <Text style={s.checkLabel}>{loc}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 7, width: '15%' }}>2. 工作性質：</Text>
            <View style={s.checkRow}>
              {WORK_TYPES.map((wt) => (
                <View key={wt} style={s.checkItem}>
                  <CB checked={data.selectedWorkTypes.includes(wt)} />
                  <Text style={s.checkLabel}>{wt}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Section 2: Hazards */}
        <Text style={s.sectionTitle}>二、工作場所可能之危害因素：</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginLeft: 10, marginBottom: 2, gap: 2 }}>
          {HAZARD_FACTORS.map((h) => (
            <View key={h} style={[s.checkItem, { width: '22%' }]}>
              <CB checked={data.selectedHazards.includes(h)} />
              <Text style={s.checkLabel}>{h}</Text>
            </View>
          ))}
          <View style={[s.checkItem, { width: '22%' }]}>
            <CB checked={!!data.otherHazard} />
            <Text style={s.checkLabel}>其他：{data.otherHazard}</Text>
          </View>
        </View>

        {/* Section 3: Safety Measures */}
        <Text style={s.sectionTitle}>三、應採取之安全衛生防範措施：</Text>
        {SAFETY_MEASURES.map((m, i) => (
          <View key={i} style={s.bulletItem}>
            <Text style={s.bullet}>•</Text>
            <Text style={s.bulletText}>{m}</Text>
          </View>
        ))}

        {/* Signatures */}
        <View style={s.signatureSection}>
          <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 4 }}>入場施工人員簽名：</Text>
          <View style={s.signatureGrid}>
            {data.attendees.filter(Boolean).map((name, i) => (
              <Text key={i} style={s.signatureBox}>{name}</Text>
            ))}
          </View>
          <View style={s.supervisorRow}>
            <Text style={{ fontSize: 8, fontWeight: 700 }}>工作負責人：</Text>
            <Text style={{ fontSize: 8, borderBottomWidth: 0.5, borderBottomColor: '#000', minWidth: 100, paddingBottom: 2 }}>
              {data.supervisorName}
            </Text>
          </View>
        </View>

        <Text style={s.footer}>維護保養暨系統效能保證合約</Text>
      </Page>
    </Document>
  );
}

export async function generateToolboxMeetingPdf(data: ToolboxMeetingData) {
  const blob = await pdf(<ToolboxMeetingDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = data.notifyDate || new Date().toISOString().slice(0, 10);
  link.download = `工具箱會議_${data.projectName || '未命名'}_${dateStr}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
