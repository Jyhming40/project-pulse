import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

// Register font
Font.register({
  family: 'NotoSansTC',
  src: '/fonts/NotoSansTC-Regular.ttf',
});

export interface CleaningReportData {
  siteCode: string;
  siteName: string;
  siteLocation: string;
  moduleCount: string;
  contractor: string;
  inspectionDate: string;
  workers: string;
  ownerInspector: string;
  roofLeak: 'yes' | 'no';
  moduleDamage: 'yes' | 'no';
  damagedCount: string;
  description: string;
  managerName: string;
  handlerName: string;
  contractorSignName: string;
}

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'NotoSansTC',
    fontSize: 10,
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 700,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    minHeight: 28,
  },
  rowNoBorder: {
    flexDirection: 'row',
    minHeight: 28,
  },
  cellLabel: {
    backgroundColor: '#f0f0f0',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#000',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 9,
  },
  cellValue: {
    padding: 6,
    justifyContent: 'center',
    fontSize: 10,
  },
  cellValueBorder: {
    padding: 6,
    justifyContent: 'center',
    fontSize: 10,
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  photoBox: {
    minHeight: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    padding: 6,
  },
  photoLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#666',
    marginBottom: 4,
  },
  photoPlaceholder: {
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
    marginTop: 30,
  },
  signRow: {
    flexDirection: 'row',
    minHeight: 50,
  },
  signCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#000',
    padding: 6,
  },
  signCellLast: {
    flex: 1,
    padding: 6,
  },
  signLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#666',
    marginBottom: 4,
  },
  signValue: {
    fontSize: 10,
    marginTop: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    fontSize: 9,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#000',
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#000',
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  checkMark: {
    color: '#fff',
    fontSize: 7,
    fontWeight: 700,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#999',
    textAlign: 'center',
  },
});

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <View style={checked ? s.checkboxChecked : s.checkbox}>
      {checked && <Text style={s.checkMark}>✓</Text>}
    </View>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '　　年　　月　　日';
  const d = new Date(dateStr);
  const y = d.getFullYear() - 1911; // ROC year
  return `${y} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function CleaningReportDocument({ data }: { data: CleaningReportData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>表 3-5：模組清洗報告</Text>

        <View style={s.table}>
          {/* Row 1: 案場代號 | 案場名稱 | 案場地點 | 模組片數 */}
          <View style={s.row}>
            <View style={[s.cellLabel, { width: '15%' }]}>
              <Text>案場代號</Text>
            </View>
            <View style={[s.cellValueBorder, { width: '20%' }]}>
              <Text>{data.siteCode}</Text>
            </View>
            <View style={[s.cellLabel, { width: '15%' }]}>
              <Text>案場名稱</Text>
            </View>
            <View style={[s.cellValueBorder, { width: '20%' }]}>
              <Text>{data.siteName}</Text>
            </View>
            <View style={[s.cellLabel, { width: '10%' }]}>
              <Text>案場地點</Text>
            </View>
            <View style={[s.cellValue, { width: '20%' }]}>
              <Text>{data.siteLocation}</Text>
            </View>
          </View>

          {/* Row 1.5: 模組片數 row */}
          <View style={s.row}>
            <View style={[s.cellLabel, { width: '15%' }]}>
              <Text>模組片數</Text>
            </View>
            <View style={[s.cellValueBorder, { width: '20%' }]}>
              <Text>{data.moduleCount ? `${data.moduleCount} 片` : ''}</Text>
            </View>
            <View style={[s.cellLabel, { width: '15%' }]}>
              <Text>施工廠商</Text>
            </View>
            <View style={[s.cellValue, { width: '50%' }]}>
              <Text>{data.contractor}</Text>
            </View>
          </View>

          {/* Row 2: 驗收日期 */}
          <View style={s.row}>
            <View style={[s.cellLabel, { width: '15%' }]}>
              <Text>驗收日期</Text>
            </View>
            <View style={[s.cellValueBorder, { width: '20%' }]}>
              <Text>{formatDate(data.inspectionDate)}</Text>
            </View>
            <View style={[s.cellLabel, { width: '15%' }]}>
              <Text>施工人員</Text>
            </View>
            <View style={[s.cellValueBorder, { width: '20%' }]}>
              <Text>{data.workers}</Text>
            </View>
            <View style={[s.cellLabel, { width: '15%' }]}>
              <Text>甲方驗收人員</Text>
            </View>
            <View style={[s.cellValue, { width: '15%' }]}>
              <Text>{data.ownerInspector}</Text>
            </View>
          </View>

          {/* 清洗前請確認 section */}
          <View style={s.row}>
            <View style={[s.cellLabel, { width: '100%', backgroundColor: '#e0e0e0' }]}>
              <Text>清洗前請確認</Text>
            </View>
          </View>

          <View style={[s.row, { minHeight: 40 }]}>
            <View style={[s.cellValue, { width: '50%', borderRightWidth: 1, borderRightColor: '#000' }]}>
              <View style={s.checkItem}>
                <CheckBox checked={data.roofLeak === 'no'} />
                <Text>屋頂無漏水現象。</Text>
              </View>
              <View style={s.checkItem}>
                <CheckBox checked={data.roofLeak === 'yes'} />
                <Text>屋頂有漏水現象。（請於清洗前通知甲方）</Text>
              </View>
            </View>
            <View style={[s.cellValue, { width: '50%' }]}>
              <View style={s.checkItem}>
                <CheckBox checked={data.moduleDamage === 'no'} />
                <Text>模組無破損。</Text>
              </View>
              <View style={s.checkItem}>
                <CheckBox checked={data.moduleDamage === 'yes'} />
                <Text>模組有破損 {data.damagedCount || '___'} 片。（請於清洗前通知甲方）</Text>
              </View>
            </View>
          </View>

          {/* 說明 */}
          <View style={[s.row, { minHeight: 40 }]}>
            <View style={[s.cellLabel, { width: '15%' }]}>
              <Text>說明</Text>
            </View>
            <View style={[s.cellValue, { width: '85%' }]}>
              <Text>{data.description}</Text>
            </View>
          </View>

          {/* 清洗前照片 */}
          <View style={s.photoBox}>
            <Text style={s.photoLabel}>清洗前照片</Text>
            <Text style={s.photoPlaceholder}>（請黏貼或列印照片）</Text>
          </View>

          {/* 清洗中照片 */}
          <View style={s.photoBox}>
            <Text style={s.photoLabel}>清洗中照片</Text>
            <Text style={s.photoPlaceholder}>（請黏貼或列印照片）</Text>
          </View>

          {/* 清洗後照片 */}
          <View style={s.photoBox}>
            <Text style={s.photoLabel}>清洗後照片</Text>
            <Text style={s.photoPlaceholder}>（請黏貼或列印照片）</Text>
          </View>

          {/* 簽章區 */}
          <View style={s.signRow}>
            <View style={s.signCell}>
              <Text style={s.signLabel}>主管</Text>
              <Text style={s.signValue}>{data.managerName}</Text>
            </View>
            <View style={s.signCell}>
              <Text style={s.signLabel}>承辦人</Text>
              <Text style={s.signValue}>{data.handlerName}</Text>
            </View>
            <View style={s.signCellLast}>
              <Text style={s.signLabel}>施工廠商</Text>
              <Text style={s.signValue}>{data.contractorSignName}</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer}>維護保養暨系統效能保證合約</Text>
      </Page>
    </Document>
  );
}

export async function generateCleaningReportPdf(data: CleaningReportData) {
  const blob = await pdf(<CleaningReportDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = data.inspectionDate || new Date().toISOString().slice(0, 10);
  link.download = `模組清洗報告_${data.siteName || '未命名'}_${dateStr}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
