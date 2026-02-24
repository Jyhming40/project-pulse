import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansTC',
  src: '/fonts/NotoSansTC-Regular.ttf',
});

export interface PersonnelEntry {
  seq: number;
  role: string;
  name: string;
  gender: string;
  birthDate: string;
  bloodType: string;
  emergencyContact: string;
}

export interface PersonnelRosterData {
  projectName: string;
  constructionDate: string;
  contractor: string;
  personnel: PersonnelEntry[];
}

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'NotoSansTC', fontSize: 9 },
  title: { fontSize: 14, textAlign: 'center', marginBottom: 4, fontWeight: 700 },
  subtitle: { fontSize: 10, textAlign: 'center', marginBottom: 12, fontWeight: 700 },
  note: { fontSize: 7.5, marginBottom: 10, color: '#444' },
  table: { width: '100%', borderWidth: 1, borderColor: '#000' },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    backgroundColor: '#f0f0f0',
    minHeight: 26,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    minHeight: 22,
  },
  rowLast: {
    flexDirection: 'row',
    minHeight: 22,
  },
  cell: {
    padding: 4,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  cellLast: {
    padding: 4,
    justifyContent: 'center',
  },
  headerText: { fontWeight: 700, fontSize: 8, textAlign: 'center' },
  cellText: { fontSize: 8, textAlign: 'center' },
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

const COL_WIDTHS = ['7%', '13%', '12%', '7%', '25%', '7%', '29%'];

function PersonnelRosterDocument({ data }: { data: PersonnelRosterData }) {
  // Pad to 20 rows
  const rows: PersonnelEntry[] = [...data.personnel];
  while (rows.length < 20) {
    rows.push({
      seq: rows.length + 1,
      role: '',
      name: '',
      gender: '',
      birthDate: '',
      bloodType: '',
      emergencyContact: '',
    });
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>表 3-8：工程進場施作人員名冊</Text>
        <Text style={s.subtitle}>工程進場施作人員名冊</Text>
        <Text style={s.note}>
          ※ 承攬雇主之施作人員（含臨時聘僱作業人員）行之保險條件要求投保相關保險並應將保單證明
        </Text>

        <View style={s.table}>
          {/* Header */}
          <View style={s.headerRow}>
            {['編碼', '工作職稱', '姓名', '性別', '出生年月日\n（後三碼以XXX表示）', '血型', '緊急聯絡人／電話'].map((h, i) => (
              <View key={i} style={[i < 6 ? s.cell : s.cellLast, { width: COL_WIDTHS[i] }]}>
                <Text style={s.headerText}>{h}</Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          {rows.map((person, i) => (
            <View key={i} style={i < rows.length - 1 ? s.row : s.rowLast}>
              <View style={[s.cell, { width: COL_WIDTHS[0] }]}>
                <Text style={s.cellText}>{person.seq}</Text>
              </View>
              <View style={[s.cell, { width: COL_WIDTHS[1] }]}>
                <Text style={s.cellText}>{person.role}</Text>
              </View>
              <View style={[s.cell, { width: COL_WIDTHS[2] }]}>
                <Text style={s.cellText}>{person.name}</Text>
              </View>
              <View style={[s.cell, { width: COL_WIDTHS[3] }]}>
                <Text style={s.cellText}>{person.gender}</Text>
              </View>
              <View style={[s.cell, { width: COL_WIDTHS[4] }]}>
                <Text style={s.cellText}>{person.birthDate}</Text>
              </View>
              <View style={[s.cell, { width: COL_WIDTHS[5] }]}>
                <Text style={s.cellText}>{person.bloodType}</Text>
              </View>
              <View style={[s.cellLast, { width: COL_WIDTHS[6] }]}>
                <Text style={s.cellText}>{person.emergencyContact}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.footer}>維護保養暨系統效能保證合約</Text>
      </Page>
    </Document>
  );
}

export async function generatePersonnelRosterPdf(data: PersonnelRosterData) {
  const blob = await pdf(<PersonnelRosterDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = data.constructionDate || new Date().toISOString().slice(0, 10);
  link.download = `人員名冊_${data.projectName || '未命名'}_${dateStr}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
