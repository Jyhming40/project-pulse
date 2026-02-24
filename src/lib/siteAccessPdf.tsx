import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansTC',
  src: '/fonts/NotoSansTC-Regular.ttf',
});

export interface SiteAccessData {
  projectName: string;
  siteLocation: string;
  applicantCompany: string;
  applicantName: string;
  applicantPhone: string;
  applicantEmail: string;
  applyDate: string;
  startDate: string;
  endDate: string;
  workPurpose: string;
  workContent: string;
  personnelCount: number;
  vehicleCount: number;
  vehicleDetails: string;
  toolsEquipment: string;
  safetyMeasures: string;
  insuranceCoverage: string;
  insuranceExpiry: string;
  approverName: string;
  approverTitle: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  note: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '　　年　　月　　日';
  const d = new Date(dateStr);
  const y = d.getFullYear() - 1911;
  return `${y} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待審核',
  approved: '核　准',
  rejected: '不予核准',
};

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'NotoSansTC', fontSize: 9 },
  title: { fontSize: 14, textAlign: 'center', fontWeight: 700, marginBottom: 14 },
  table: { borderWidth: 1, borderColor: '#000' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', minHeight: 24 },
  labelCell: { width: '22%', backgroundColor: '#f5f5f5', padding: 4, borderRightWidth: 0.5, borderRightColor: '#000', justifyContent: 'center' },
  valueCell: { flex: 1, padding: 4, justifyContent: 'center' },
  valueCellHalf: { width: '28%', padding: 4, borderRightWidth: 0.5, borderRightColor: '#000', justifyContent: 'center' },
  labelText: { fontSize: 8, fontWeight: 700 },
  valueText: { fontSize: 8 },
  sectionHeader: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', minHeight: 22, backgroundColor: '#e8e8e8' },
  sectionHeaderText: { fontSize: 9, fontWeight: 700, padding: 4 },
  signatureArea: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBlock: { width: '30%', alignItems: 'center' },
  signatureLine: { borderBottomWidth: 0.5, borderBottomColor: '#000', width: '100%', marginTop: 30, marginBottom: 4 },
  signatureLabel: { fontSize: 8, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 15, left: 36, right: 36, fontSize: 6, color: '#999', textAlign: 'center' },
});

function Row({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <View style={s.row}>
      <View style={s.labelCell}><Text style={s.labelText}>{label}</Text></View>
      <View style={fullWidth ? s.valueCell : s.valueCell}><Text style={s.valueText}>{children}</Text></View>
    </View>
  );
}

function TwoColRow({ label1, value1, label2, value2 }: { label1: string; value1: string; label2: string; value2: string }) {
  return (
    <View style={s.row}>
      <View style={s.labelCell}><Text style={s.labelText}>{label1}</Text></View>
      <View style={s.valueCellHalf}><Text style={s.valueText}>{value1}</Text></View>
      <View style={[s.labelCell, { width: '18%' }]}><Text style={s.labelText}>{label2}</Text></View>
      <View style={s.valueCell}><Text style={s.valueText}>{value2}</Text></View>
    </View>
  );
}

function SiteAccessDocument({ data }: { data: SiteAccessData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>表 3-7：工程進場施作申請單</Text>

        <View style={s.table}>
          {/* Section: Project Info */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>壹、工程資訊</Text>
          </View>
          <Row label="工程名稱">{data.projectName}</Row>
          <Row label="工程地點">{data.siteLocation}</Row>

          {/* Section: Applicant */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>貳、申請人資訊</Text>
          </View>
          <TwoColRow label1="申請單位" value1={data.applicantCompany} label2="申請人" value2={data.applicantName} />
          <TwoColRow label1="聯絡電話" value1={data.applicantPhone} label2="E-mail" value2={data.applicantEmail} />
          <Row label="申請日期">{formatDate(data.applyDate)}</Row>

          {/* Section: Work */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>參、施工期間與內容</Text>
          </View>
          <TwoColRow label1="進場日期" value1={formatDate(data.startDate)} label2="離場日期" value2={formatDate(data.endDate)} />
          <Row label="施工目的">{data.workPurpose}</Row>
          <Row label="施工內容">{data.workContent}</Row>

          {/* Section: Resources */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>肆、人員與車輛</Text>
          </View>
          <TwoColRow label1="進場人數" value1={`${data.personnelCount} 人`} label2="車輛數" value2={`${data.vehicleCount} 輛`} />
          <Row label="車輛說明">{data.vehicleDetails}</Row>
          <Row label="工具/設備">{data.toolsEquipment}</Row>

          {/* Section: Safety */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>伍、安全與保險</Text>
          </View>
          <Row label="安全防護措施">{data.safetyMeasures}</Row>
          <TwoColRow label1="保險承保" value1={data.insuranceCoverage} label2="保險到期" value2={formatDate(data.insuranceExpiry)} />

          {/* Section: Approval */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>陸、核准</Text>
          </View>
          <TwoColRow label1="核准狀態" value1={STATUS_LABELS[data.approvalStatus] || data.approvalStatus} label2="核准人" value2={`${data.approverName}${data.approverTitle ? ` / ${data.approverTitle}` : ''}`} />
          <Row label="備註">{data.note}</Row>
        </View>

        {/* Signatures */}
        <View style={s.signatureArea}>
          <View style={s.signatureBlock}>
            <Text style={s.signatureLabel}>申請人</Text>
            <View style={s.signatureLine} />
            <Text style={{ fontSize: 7 }}>{data.applicantName}</Text>
          </View>
          <View style={s.signatureBlock}>
            <Text style={s.signatureLabel}>現場負責人</Text>
            <View style={s.signatureLine} />
          </View>
          <View style={s.signatureBlock}>
            <Text style={s.signatureLabel}>核准人</Text>
            <View style={s.signatureLine} />
            <Text style={{ fontSize: 7 }}>{data.approverName}</Text>
          </View>
        </View>

        <Text style={s.footer}>維護保養暨系統效能保證合約</Text>
      </Page>
    </Document>
  );
}

export async function generateSiteAccessPdf(data: SiteAccessData) {
  const blob = await pdf(<SiteAccessDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = data.applyDate || new Date().toISOString().slice(0, 10);
  link.download = `進場申請_${data.projectName || '未命名'}_${dateStr}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
