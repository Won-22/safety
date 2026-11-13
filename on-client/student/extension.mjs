// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
const DEVICE_STATUS = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
const SESSION_STATUS = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
const MODE = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' };

// 정상이 아닌 상태는 색이 아니라 "주의:" 글자로 구분한다. 모르는 값은 확인 불가로 본다.
const statusText = (names, status, normal) => `${status === normal ? '' : '주의: '}${names[status] ?? names.unknown}`;

function line(text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

// 자료 하나(me·devices·sessions)를 loading / ok / error 별로 그린다. 입력값만 읽고 이전 값은 보관하지 않는다.
function identitySection(title, resource, rows) {
  const box = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = title;
  box.append(heading);
  if (MODE[resource?.mode]) box.append(line(`자료 상태: ${MODE[resource.mode]}`));
  if (resource?.status === 'loading') box.append(line('불러오는 중'));
  else if (resource?.status === 'error') box.append(line(`연결 실패: ${resource.error?.message ?? '확인 불가'}`));
  else if (resource?.status === 'ok' && resource.data) box.append(...rows(resource.data));
  else box.append(line('확인 불가'));
  return box;
}

const meRows = (data) => [
  line(`사용자: ${data.user?.label ?? '확인 불가'} (${data.user?.id ?? '-'})`),
  line(`현재 기기: ${data.device?.label ?? '확인 불가'} · ${statusText(DEVICE_STATUS, data.device?.status, 'compliant')}`),
  line(`현재 세션: ${data.session?.id ?? '-'} · ${statusText(SESSION_STATUS, data.session?.status, 'active')}`),
];
const listRows = (empty, row) => (data) => (Array.isArray(data) && data.length ? data.map(row) : [line(empty)]);
const deviceRows = listRows('기기 없음', (d) => line(`${d.label ?? '이름 없음'} (${d.id}) · ${statusText(DEVICE_STATUS, d.status, 'compliant')}`));
const sessionRows = listRows('세션 없음', (s) => line(`${s.id} · ${statusText(SESSION_STATUS, s.status, 'active')}`));

export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('div');
      root.append(identitySection('사용자·현재 기기·현재 세션', me, meRows), identitySection('기기 목록', devices, deviceRows), identitySection('세션 목록', sessions, sessionRows));
      return root;
    },
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
