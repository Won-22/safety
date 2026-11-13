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

// 입력으로 들어온 미지원 조치마다 비활성 버튼과 안내를 둔다. 눌러도 아무 요청도 보내지 않는다(이벤트 처리기가 없다). 목록이 비어 있으면 만들지 않는다.
function unsupportedActions(list) {
  const names = (Array.isArray(list) ? list : []).map((a) => (typeof a === 'string' ? a : a?.id ?? a?.action)).filter((a) => typeof a === 'string' && a);
  if (!names.length) return [];
  return [node('h5', '조치'), line('조치 실행 연결은 준비 중입니다. 아직 지원하지 않는 조치이며 어떤 요청도 보내지 않습니다.'), ...names.map((name) => {
    const button = node('button', `${name} 미지원`);
    button.type = 'button';
    button.disabled = true;
    button.setAttribute('aria-label', `${name} 미지원`);
    return button;
  })];
}

function eventDetail(e) {
  const box = node('div');
  box.setAttribute('data-student-event-detail', e.id);
  const items = (title, list, empty) => [node('h5', title), ...(Array.isArray(list) && list.length ? list.map((x) => line(`${x?.id}: ${x?.text}`)) : [line(empty)])];
  box.append(
    node('h4', `${e.id} 상세`), line(`사건 ID: ${e.id}`), line(`종류: ${withRaw(KIND_TEXT, e.kind)}`), line(`앱: ${appText(e)}`),
    ...items('근거', e.evidence, '근거 없음'), ...items('규칙', e.rules, '규칙 없음'),
    node('h5', '상태'), line(`접속 판정: ${withRaw(ACCESS_STATUS, e.state?.access)}`), line(`세션: ${withRaw(SESSION_STATUS, e.state?.session)}`), line(`기기: ${withRaw(DEVICE_STATUS, e.state?.device)}`),
    ...unsupportedActions(e.supportedActions),
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

const RETRY = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.';

// 자료 하나(기기·세션)를 불러오는 중 / 빈 목록 / 실패 / 목록으로 나눠 그린다. 실패와 빈 목록은 문장이 다르다.
function statusSection(title, resource, scope, empty, row) {
  const box = node('section');
  box.append(node('h4', title), line(scope));
  if (MODE[resource?.mode]) box.append(line(`자료 상태: ${MODE[resource.mode]}`));
  if (resource?.status === 'loading') box.append(line('불러오는 중'));
  else if (resource?.status === 'error') {
    const timeout = /TIMEOUT/u.test(String(resource.error?.code));
    box.append(line(`${title}을(를) 불러오지 못했습니다${timeout ? '(시간 초과)' : ''}: ${resource.error?.message ?? '확인 불가'}`), line(RETRY));
  } else if (resource?.status === 'ok' && Array.isArray(resource.data)) box.append(...(resource.data.length ? resource.data.map(row) : [line(empty)]));
  else box.append(line('확인 불가'));
  return box;
}

// 도움 요청에 쓸 값은 이 여섯 개만 고른다. 그 밖의 값(설정·인증 정보 등)은 화면에도 복사본에도 넣지 않는다.
function helpFields(data) {
  return [
    ['요청 ID', data?.requestId], ['구성 요소', data?.component], ['버전', data?.version], ['확인 시각', data?.checkedAt],
    ['엔진 모드', data?.engine?.mode], ['엔진 코드', data?.engine?.code],
  ].map(([name, value]) => `${name}: ${typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 200) : '확인 불가'}`);
}

function helpSection(diagnostics) {
  const box = node('section');
  box.append(node('h4', '도움정보'));
  const note = line('');
  const copy = node('button', '도움정보 복사');
  copy.type = 'button';
  copy.setAttribute('aria-label', '도움정보 복사');
  copy.disabled = true;
  if (diagnostics?.status === 'loading') box.append(line('도움정보를 불러오는 중'));
  else if (diagnostics?.status === 'error') box.append(line(`도움정보를 불러오지 못했습니다: ${diagnostics.error?.message ?? '확인 불가'}`), line(RETRY));
  else if (diagnostics?.status === 'ok' && diagnostics.data) {
    const fields = helpFields(diagnostics.data);
    box.append(...fields.map(line));
    copy.disabled = false;
    // 사용자가 누를 때만 복사한다. 어디로도 전송하지 않는다.
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(fields.join('\n'));
        note.textContent = '도움정보를 클립보드에 복사했습니다.';
      } catch {
        note.textContent = '복사하지 못했습니다. 위 내용을 직접 선택해 복사하세요.';
      }
    });
  } else box.append(line('도움정보를 아직 조회하지 않았습니다.'));
  box.append(line('이 정보는 도움 요청에 쓰도록 복사하는 것이며, 누를 때만 복사하고 어디에도 전송하지 않습니다.'), copy, note);
  return box;
}

function statusView({ devices, sessions, notifications, diagnostics, mode } = {}) {
  const root = node('div');
  root.append(node('h3', '기기·세션·알림·도움정보'));
  if (MODE[mode]) root.append(line(`자료 상태: ${MODE[mode]}`));
  root.append(
    statusSection('기기', devices, '등록된 내 기기(회수되지 않은 것, 최대 100개)입니다.', '등록된 기기가 없습니다', (d) => line(`${d?.label || '이름 없음'}(${d?.id ?? '-'}) · ${withRaw(DEVICE_STATUS, d?.status)}`)),
    statusSection('세션', sessions, '현재 검증된 연결 한 개만 조회합니다. 과거 세션 전체 목록이 아닙니다.', '현재 연결이 없습니다', (s) => line(`${s?.id ?? '-'} · ${withRaw(SESSION_STATUS, s?.status)}`)),
  );
  const alerts = node('section');
  alerts.append(node('h4', '알림'));
  const list = Array.isArray(notifications) ? notifications : [];
  alerts.append(...(list.length ? list.map((n) => line(`자료: ${n?.resource ?? '확인 불가'} · 코드: ${n?.code ?? '확인 불가'} · ${n?.message ?? ''}`)) : [line('주의할 알림이 없습니다')]));
  root.append(alerts, helpSection(diagnostics));
  return root;
}

// AI 연결 오류를 원인별로 나눈다. 화면에는 제공 화면이 걸러 준 code·message만 쓰고, 원문 오류나 열쇠는 쓰지 않는다.
const AI_CAUSES = [
  ['권한 준비 중·확인 불가', '담당자에게 계정 연결과 앱 권한 확인을 요청하세요.', ['ON_AI_PROVISIONING_PENDING', 'AI_REQUEST_UNVERIFIED', 'SUBJECT_SCOPE_UNVERIFIED', 'ON_AI_AUTHORIZATION_CHANGED', 'ON_AI_INVALID_INPUT', 'ON_AI_INVALID_OUTPUT', 'INVALID_RESPONSE', 'NOT_ALLOWED']],
  ['인증 실패', '계정 연결을 다시 확인하고 담당자에게 확인하세요.', ['WB_CLCO_AUTH_REQUIRED']],
  ['접근 제한', '계정 연결을 다시 확인하고 담당자에게 확인하세요.', ['WB_CLCO_ACCESS_BLOCKED']],
  ['반 사용량·이용 한도', '담당자에게 확인하세요.', ['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED']],
  ['이용 시간 아님', '이용 시간을 확인하세요.', ['WB_CLCO_SESSION_CLOSED']],
  ['요청 제한·시간 초과·네트워크', '잠시 뒤 직접 다시 점검하세요.', ['WB_CLCO_RATE_LIMITED', 'WB_CLCO_TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'TIMEOUT', 'NETWORK_ERROR']],
  ['취소', '취소됐습니다. 이전 결과는 현재 결과가 아닙니다.', ['WB_CLCO_CANCELLED', 'CANCELLED', 'REQUEST_CANCELLED']],
  ['쓸 수 있는 모델 없음', '담당자에게 모델 허용 설정 확인을 요청하세요.', ['ON_AI_MODEL_LIST_EMPTY', 'MODEL_NOT_CONFIGURED']],
];
const SAFE_CODE = /^[A-Za-z0-9_]{1,64}$/u;
const safeCode = (error) => (SAFE_CODE.test(String(error?.code)) ? String(error.code) : '확인 불가');
const safeMessage = (error) => (typeof error?.message === 'string' && error.message ? error.message.slice(0, 200) : '확인 불가');

function aiFailureLines(title, error) {
  const code = safeCode(error);
  const [cause, direction] = AI_CAUSES.find(([, , codes]) => codes.includes(code)) ?? ['확인 불가', '담당자에게 계정 연결과 앱 권한 확인을 요청하세요.'];
  return [line(`${title}: ${cause}`), line(`코드: ${code} · ${safeMessage(error)}`), line(`안내: ${direction}`), line('다시 점검은 사용자가 버튼을 직접 누르는 것이며, 자동으로 다시 점검하지 않습니다.')];
}

// 연결만 점검한 결과와 사건 설명 실행을 구분한다. 입력값만 읽고 이전 결과는 보관하지 않으므로, 새 입력이 오면 이전 오류·결과는 남지 않는다.
function aiConnectionView({ status, mode, data, error, checkedAt } = {}) {
  const root = node('div');
  root.append(node('h3', 'AI 연결 점검'));
  if (MODE[mode]) root.append(line(`자료 상태: ${MODE[mode]}`));
  if (status === 'idle') root.append(line('AI 연결 점검 전'), line('점검은 제공 화면의 현재 API 연결 점검 버튼을 사용자가 직접 눌러 시작합니다.'));
  else if (status === 'loading') root.append(line('AI 연결 점검 중'));
  else if (status === 'ok' && data) {
    const verified = data.audienceAuthorization === 'verified';
    const test = data.audienceAuthorization === 'test';
    root.append(
      line(`점검 결과: ${verified ? '앱 권한 확인 후 점검(verified)' : test ? '시험 연결 점검(test)' : `확인 불가(${data.audienceAuthorization ?? 'unknown'})`}`),
      line(verified ? '그 시각 기준 앱 권한 확인과 모델 응답입니다.' : '시험 연결이며 앱 권한 확인을 뜻하지 않습니다.'),
      line(`응답 모델 수: ${Number.isInteger(data.modelCount) ? data.modelCount : '확인 불가'}`),
      line(`점검 시각: ${checkedAt ?? '확인 불가'}`),
      line('사건 설명은 아직 실행하지 않았습니다. 모델 목록 응답은 사건 설명 결과가 아닙니다.'),
    );
  } else if (status === 'error') root.append(...aiFailureLines('AI 연결 점검 실패', error));
  else root.append(line('확인 불가: AI 연결 점검 상태를 알 수 없습니다'));
  return root;
}

// 사건 설명의 기초 표시. 성공일 때만 data-student-explanation-event를 붙이고, 실패에는 붙이지 않는다.
function explanationView({ event, explanation, checkedAt } = {}) {
  const root = node('div');
  root.append(node('h3', '사건 설명'));
  const status = explanation?.status;
  if (status === 'ok' && event?.id && typeof explanation.data?.summary === 'string') {
    root.setAttribute('data-student-explanation-event', event.id);
    root.append(line(`사건 ID: ${event.id}`), line(`설명: ${explanation.data.summary}`), line(`확인 시각: ${checkedAt ?? '확인 불가'}`), line('설명은 제안이며 조치는 자동으로 실행되지 않습니다.'));
  } else if (status === 'error') root.append(...aiFailureLines('사건 설명 실패', explanation.error).slice(0, 3), line('기록은 그대로입니다.'));
  else if (status === 'loading') root.append(line('사건 설명 요청 중'));
  else if (status === 'idle') root.append(line('사건 설명 전'));
  else root.append(line('확인 불가: 사건 설명 상태를 알 수 없습니다'));
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
    renderStatus(input) { return statusView(input); },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection(input) { return aiConnectionView(input); },
    renderExplanation(input) { return explanationView(input); },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
