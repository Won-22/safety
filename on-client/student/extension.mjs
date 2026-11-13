// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
const DEVICE_STATUS = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
const SESSION_STATUS = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
const MODE = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' };
const DECISION_TEXT = {
  allow: ['허용', '정책상 접근 허용이라는 뜻이며 실제 앱 접속 성공을 보장하지 않습니다.'],
  deny: ['거부', '정책상 접근이 거부되었습니다.'],
  challenge: ['추가 확인 필요', '추가 인증 또는 확인이 필요합니다. 이 앱이 확인 절차를 대신 수행하지 않습니다.'],
  unknown: ['확인 불가', '판정을 확인할 수 없습니다. 접근이 허용되었다는 뜻이 아닙니다.'],
};

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

const ACCESS_STATUS = { allowed: '허용됨', denied: '거부됨', unknown: '확인 불가' };
const KIND_TEXT = { access: '접속 기록', xdr: 'XDR 경보' };

// 값을 "한국어 설명(원래 값)"으로 적는다. 목록에 없는 값과 빠진 값은 확인 불가로 본다.
const withRaw = (names, value) => (Object.hasOwn(names, value) ? `${names[value]}(${value})` : `확인 불가(${value ?? 'unknown'})`);
const appText = (e) => e?.appId || '앱을 확인할 수 없음';

function node(tag, text) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
}

function eventDetail(e) {
  const box = node('div');
  box.setAttribute('data-student-event-detail', e.id);
  const items = (title, list, empty) => [node('h5', title), ...(Array.isArray(list) && list.length ? list.map((x) => line(`${x?.id}: ${x?.text}`)) : [line(empty)])];
  box.append(
    node('h4', `${e.id} 상세`), line(`사건 ID: ${e.id}`), line(`종류: ${withRaw(KIND_TEXT, e.kind)}`), line(`앱: ${appText(e)}`),
    ...items('근거', e.evidence, '근거 없음'), ...items('규칙', e.rules, '규칙 없음'),
    node('h5', '상태'), line(`접속 판정: ${withRaw(ACCESS_STATUS, e.state?.access)}`), line(`세션: ${withRaw(SESSION_STATUS, e.state?.session)}`), line(`기기: ${withRaw(DEVICE_STATUS, e.state?.device)}`),
  );
  return box;
}

// 받은 배열을 복사해 최신순으로 보여 주고, 필터와 상세는 이 배열 안에서만 처리한다(서버에 다시 묻지 않는다).
function eventList(data) {
  const rows = [...data].sort((a, b) => (Date.parse(b?.at) || 0) - (Date.parse(a?.at) || 0));
  const filters = { kind: 'all', app: 'all', access: 'all' };
  let selected = null;
  const bar = node('div');
  const count = node('p');
  const list = node('ul');
  const detail = node('div');
  const distinct = (pick) => [...new Set(rows.map(pick).filter((v) => typeof v === 'string' && v))];

  const choice = (name, key, values) => {
    const label = node('label', `${name} `);
    const select = node('select');
    select.setAttribute('aria-label', name);
    for (const [value, text] of [['all', '전체'], ...values]) {
      const option = node('option', text);
      option.value = value;
      select.append(option);
    }
    select.addEventListener('change', () => { filters[key] = select.value; draw(); });
    label.append(select);
    return label;
  };
  const row = (e) => {
    const li = node('li');
    li.setAttribute('data-student-event-id', e.id);
    const button = node('button', `${e.id} 상세`);
    button.type = 'button';
    button.setAttribute('aria-label', `${e.id} 상세`);
    button.addEventListener('click', () => { selected = e.id; draw(); });
    li.append(node('span', `${e.id} · ${e.at} · ${withRaw(KIND_TEXT, e.kind)} · 앱: ${appText(e)} · ${e.summary} `), button);
    return li;
  };
  function draw() {
    const shown = rows.filter((e) => (filters.kind === 'all' || e.kind === filters.kind) && (filters.app === 'all' || e.appId === filters.app)
      && (filters.access === 'all' || e.state?.access === filters.access));
    if (selected && !shown.some((e) => e.id === selected)) selected = null;
    count.textContent = `표시 ${shown.length}건 / 전체 ${rows.length}건`;
    list.replaceChildren(...(shown.length ? shown.map(row) : [node('li', '조건에 맞는 기록이 없습니다')]));
    detail.replaceChildren(...(selected ? [eventDetail(shown.find((e) => e.id === selected))] : []));
  }
  bar.append(
    choice('기록 종류', 'kind', distinct((e) => e.kind).map((v) => [v, withRaw(KIND_TEXT, v)])),
    choice('업무 앱', 'app', distinct((e) => e.appId).map((v) => [v, v])),
    choice('접속 상태', 'access', distinct((e) => e.state?.access).map((v) => [v, withRaw(ACCESS_STATUS, v)])),
  );
  draw();
  return [bar, count, list, detail];
}

function eventsView({ status, mode, data, error } = {}) {
  const root = node('div');
  root.append(node('h3', '접속 기록·XDR 경보'));
  if (MODE[mode]) root.append(line(`자료 상태: ${MODE[mode]}`));
  if (status === 'loading') root.append(line('기록을 불러오는 중'));
  else if (status === 'error') {
    root.append(line(error?.code === 'CONTRACT_MISMATCH' ? `확인 불가: 기록 형식을 확인할 수 없습니다. ${error?.message ?? ''}`.trim() : `기록을 불러오지 못했습니다: ${error?.message ?? '확인 불가'}`));
  } else if (status === 'ok' && Array.isArray(data)) root.append(...(data.length ? eventList(data) : [line('표시할 기록이 없습니다')]));
  else root.append(line('확인 불가: 기록 상태를 알 수 없습니다'));
  return root;
}

export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('div');
      root.append(identitySection('사용자·현재 기기·현재 세션', me, meRows), identitySection('기기 목록', devices, deviceRows), identitySection('세션 목록', sessions, sessionRows));
      return root;
    },
    // 판정(allow·deny·challenge)과 요청 실패·확인 불가를 글자로 구분한다. 목록에 없는 값은 확인 불가(unknown)로 본다.
    renderDecision({ status, mode, data, error, appId } = {}) {
      const root = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = '접속 판정';
      root.append(heading);
      if (appId) root.append(line(`업무 앱: ${appId}`));
      if (MODE[mode]) root.append(line(`자료 상태: ${MODE[mode]}`));
      if (status === 'idle') root.append(line('앱을 골라 접속을 요청하세요'));
      else if (status === 'loading') root.append(line('판정 확인 중'));
      else if (status === 'error') root.append(line(`요청 실패: ${error?.message ?? '확인 불가'}`), line('요청 실패는 접근 거부 판정이 아닙니다.'));
      else if (status === 'ok' && data) {
        const known = Object.hasOwn(DECISION_TEXT, data.decision) && data.decision !== 'unknown';
        const [name, note] = DECISION_TEXT[known ? data.decision : 'unknown'];
        root.append(line(`판정: ${name}(${known ? data.decision : 'unknown'})`), line(note), line(`이유: ${data.reason ?? '확인 불가'}`), line(`판정 시각: ${data.checkedAt ?? '확인 불가'}`));
      } else root.append(line('판정: 확인 불가(unknown)'), line(DECISION_TEXT.unknown[1]));
      return root;
    },
    renderEvents(input) { return eventsView(input); },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
