// 한국어/영어 번역 사전. 키는 점 표기법(예: "home.title").
// 새 언어 추가 시 같은 키 구조로 객체 추가.

export const TRANSLATIONS = {
  ko: {
    common: {
      retailer: '소매상', wholesaler: '도매상', distributor: '유통업자', factory: '공장',
      loading: '로딩 중...', connect_failed: '연결 실패', cancel: '취소', confirm: '확인',
      back: '뒤로', next: '다음', leave: '나가기', start: '시작', finish: '종료',
      yes: '예', no: '아니오',
      week: '주', weeks: '주', cost: '비용', total: '총합', avg: '평균', rank: '순위'
    },
    nav: {
      title: '맥주 분배 게임', subtitle: '웹 멀티팀',
      admin: '관리자', join: '참가'
    },
    home: {
      title: '맥주 분배 게임 — 멀티팀 웹 버전',
      subtitle: 'MIT Sloan에서 1960년대 개발한 공급사슬 시뮬레이션을 웹으로 — 여러 팀이 동시에 진행할 수 있습니다.',
      admin_card_title: '관리자 / 강사', admin_card_desc: '새 세션을 만들고 코드를 학생들에게 배포',
      join_card_title: '학생 / 참가자', join_card_desc: '세션 코드를 입력하고 팀에 합류',
      info_features_title: '기능:',
      info_features: '1~20팀 동시 진행 · 4역할 멀티플레이어 · 실시간 동기화(WebSocket) · 빈 자리 AI 자동 채움(4가지 정책) · 10가지 수요 패턴 · 5가지 시나리오 프리셋 · 정보 격리 모드 3종 · 실시간 차트 · 관리자 대시보드 · 결과 화면(팀 비교, 채찍효과, 자동 인사이트)',
      info_start_title: '시작하기:',
      info_start: '강사는 위 "관리자" 버튼으로 세션 만들고 6자리 코드 공유 → 학생들은 "참가" 버튼으로 코드 입력 후 팀/역할 선택 → 관리자가 "게임 시작" 누르면 모두 자동으로 게임 화면으로 이동.'
    },
    join: {
      title: '세션 합류',
      desc: '강사가 알려준 6자리 세션 코드를 입력하세요.',
      placeholder: 'ABCD23',
      submit: '계속',
      checking: '확인 중...'
    },
    teamSelect: {
      step1: '1단계 — 팀 선택', step2: '2단계 — 역할 선택', step3: '3단계 — 이름 입력',
      occupied: '합류', full: '— 빈 자리 —',
      name_placeholder: '홍길동', join: '합류하기',
      joining: '합류 중...'
    },
    lobby: {
      joined: '합류 완료', team_members: '우리 팀 멤버',
      waiting_admin: '관리자가 "게임 시작"을 누르면 자동으로 게임 화면으로 이동합니다. 빈 자리는 자동으로 AI가 채워집니다.',
      member_waiting: '— 대기 중 —', member_in: '입장', member_wait: '대기',
      leave_session: '세션 나가기'
    },
    play: {
      my_role: '내 역할', current_week: '현재 주차', team_total_cost: '팀 누적 비용',
      my_status: '내 운영 현황',
      stat_inventory: '현재 재고', stat_backlog: '백오더', stat_incoming: '이번 주 입고',
      stat_demand_or_order: '하류 주문', stat_customer: '고객 수요',
      stat_total_cost: '누적 비용', stat_last_order: '지난 주 주문',
      pipe_ship: '📦 배송 파이프라인 (앞→뒤, 곧 도착)',
      pipe_order: '📋 주문 파이프라인',
      order_factory: '생산 주문', order_upstream: '에게 주문',
      order_label: '할 수량:',
      submit_order: '주문 제출', submitting: '제출 중...',
      submitted: '✓ 이번 주 주문 제출 완료. 다른 멤버를 기다리는 중...',
      teammates: '팀원 상태',
      submitted_chip: '제출 ✓', waiting_chip: '대기',
      week_done: '주 {week} 완료. 다음 주 주문을 입력하세요.',
      auto_filled: '{count}개 자리가 시간 초과로 AI 자동 결정됐습니다.',
      charts_toggle: '📊 차트 보기'
    },
    results: {
      finished: '게임 종료',
      bullwhip_max: '채찍효과 최대 증폭',
      our_total_cost: '우리 팀 누적 비용', our_rank: '우리 팀 순위',
      class_avg: '반 평균',
      badges_title: '🎖 성취 배지',
      scoreboard: '최종 점수판 (우리 팀)',
      role: '역할', amplification: '채찍효과 증폭',
      max_inv: '최대 재고', max_back: '최대 백오더',
      order_var: '주문 변동성*', order_var_note: '* 표준편차 (낮을수록 안정적)',
      our_charts: '📈 우리 팀 시각화',
      bullwhip_compare: '📊 팀별 채찍효과 비교',
      bullwhip_desc: '역할별 주문 변동성(표준편차). 막대가 높을수록 채찍효과가 큼.',
      cost_compare: '💰 팀별 누적 비용 추이',
      ranking: '🏆 팀 순위',
      insights: '💡 우리 팀 인사이트',
      general_lessons: '🎓 일반 학습 포인트',
      lessons_list: [
        '각 단계가 자기 정보만 보고 결정하면 시스템 전체가 비효율적이 됩니다.',
        '주문/배송 지연은 시스템 동학을 불안정하게 만듭니다 — 짧은 리드타임이 핵심.',
        '해결책: ① POS 데이터 공유 (VMI, CPFR), ② 일관된 주문 정책 (base-stock), ③ 협력 예측.',
        '현실 적용: Walmart-P&G의 VMI 협력, Dell의 Build-to-Order, Zara의 Quick Response.'
      ],
      export_csv: '📁 CSV 내보내기'
    },
    admin: {
      create_session: '새 세션 만들기',
      team_count: '팀 개수 (1~20)', team_count_help: '{n}개 팀이 자동 생성됩니다 (1조 ~ {n}조)',
      preset: '시나리오 프리셋',
      preset_help: '아래 옵션을 직접 조정하면 프리셋이 해제됩니다.',
      game_rules: '게임 규칙',
      weeks: '전체 주차', order_delay: '주문 지연 (주)', ship_delay: '배송 지연 (주)',
      start_inv: '시작 재고',
      hold_cost: '재고 보유비용 ($/단위/주)', back_cost: '백오더 비용 ($/단위/주)',
      demand_pattern: '고객 수요 패턴',
      info_mode: '정보 격리 모드',
      info_full: '완전 (인접 단계만 — MIT 정통)',
      info_partial: '부분 (자기 단계만)',
      info_open: '개방 (모든 정보 공개)',
      ai_policy: 'AI 정책 (빈 자리 채울 AI의 의사결정 방식)',
      submit: '세션 만들기',
      submitting: '생성 중...'
    }
  },
  en: {
    common: {
      retailer: 'Retailer', wholesaler: 'Wholesaler', distributor: 'Distributor', factory: 'Factory',
      loading: 'Loading...', connect_failed: 'Connection failed', cancel: 'Cancel', confirm: 'Confirm',
      back: 'Back', next: 'Next', leave: 'Leave', start: 'Start', finish: 'Finish',
      yes: 'Yes', no: 'No',
      week: 'Week', weeks: 'weeks', cost: 'Cost', total: 'Total', avg: 'Avg', rank: 'Rank'
    },
    nav: {
      title: 'Beer Distribution Game', subtitle: 'Multi-Team Web',
      admin: 'Admin', join: 'Join'
    },
    home: {
      title: 'Beer Distribution Game — Multi-Team Web Edition',
      subtitle: 'A web implementation of MIT Sloan\'s classic supply chain simulation — multiple teams can play simultaneously.',
      admin_card_title: 'Admin / Instructor', admin_card_desc: 'Create a session and share code with students',
      join_card_title: 'Student / Participant', join_card_desc: 'Enter session code and join a team',
      info_features_title: 'Features:',
      info_features: '1–20 teams simultaneous · 4-role multiplayer · Real-time sync (WebSocket) · AI auto-fill (4 policies) · 10 demand patterns · 5 scenario presets · 3 information modes · Live charts · Admin dashboard · Results page (team comparison, bullwhip, auto insights)',
      info_start_title: 'Getting started:',
      info_start: 'Instructor clicks "Admin" to create a session and shares the 6-char code → Students click "Join" to enter the code and pick their team/role → Instructor clicks "Start Game" and everyone auto-routes to the game screen.'
    },
    join: {
      title: 'Join Session',
      desc: 'Enter the 6-character session code shared by your instructor.',
      placeholder: 'ABCD23',
      submit: 'Continue',
      checking: 'Checking...'
    },
    teamSelect: {
      step1: 'Step 1 — Pick a team', step2: 'Step 2 — Pick a role', step3: 'Step 3 — Enter your name',
      occupied: 'joined', full: '— empty —',
      name_placeholder: 'Your name', join: 'Join',
      joining: 'Joining...'
    },
    lobby: {
      joined: 'Joined', team_members: 'Team members',
      waiting_admin: 'When the admin clicks "Start Game", you\'ll auto-route to the game screen. Empty seats are filled by AI automatically.',
      member_waiting: '— waiting —', member_in: 'in', member_wait: 'waiting',
      leave_session: 'Leave session'
    },
    play: {
      my_role: 'My role', current_week: 'Current week', team_total_cost: 'Team total cost',
      my_status: 'My operations',
      stat_inventory: 'Inventory', stat_backlog: 'Backlog', stat_incoming: 'Incoming this week',
      stat_demand_or_order: 'Downstream order', stat_customer: 'Customer demand',
      stat_total_cost: 'Cumulative cost', stat_last_order: 'Last week order',
      pipe_ship: '📦 Shipment pipeline (front→back, arriving soon)',
      pipe_order: '📋 Order pipeline',
      order_factory: 'Production order', order_upstream: ' order',
      order_label: 'Quantity:',
      submit_order: 'Submit order', submitting: 'Submitting...',
      submitted: '✓ Order submitted. Waiting for teammates...',
      teammates: 'Teammates',
      submitted_chip: 'Submitted ✓', waiting_chip: 'Waiting',
      week_done: 'Week {week} complete. Enter next week\'s order.',
      auto_filled: '{count} seat(s) timed out and were auto-filled by AI.',
      charts_toggle: '📊 Show charts'
    },
    results: {
      finished: 'Game over',
      bullwhip_max: 'Max bullwhip amplification',
      our_total_cost: 'Our team\'s total cost', our_rank: 'Our team\'s rank',
      class_avg: 'Class average',
      badges_title: '🎖 Achievement Badges',
      scoreboard: 'Final scoreboard (our team)',
      role: 'Role', amplification: 'Bullwhip amp.',
      max_inv: 'Max inventory', max_back: 'Max backlog',
      order_var: 'Order variability*', order_var_note: '* Standard deviation (lower = more stable)',
      our_charts: '📈 Our team visualization',
      bullwhip_compare: '📊 Bullwhip Comparison Across Teams',
      bullwhip_desc: 'Order variability (std dev) per role. Higher bars = stronger bullwhip effect.',
      cost_compare: '💰 Cumulative Cost Trajectory by Team',
      ranking: '🏆 Team Ranking',
      insights: '💡 Our Team Insights',
      general_lessons: '🎓 General Lessons',
      lessons_list: [
        'When each tier optimizes only with local information, the system as a whole becomes inefficient.',
        'Order/shipping delays destabilize the system\'s dynamics — short lead time is key.',
        'Solutions: ① POS data sharing (VMI, CPFR), ② consistent ordering policy (base-stock), ③ collaborative forecasting.',
        'Real-world: Walmart-P&G VMI, Dell\'s Build-to-Order, Zara\'s Quick Response.'
      ],
      export_csv: '📁 Export CSV'
    },
    admin: {
      create_session: 'Create New Session',
      team_count: 'Number of teams (1–20)', team_count_help: '{n} teams will be auto-created (Team 1 ~ Team {n})',
      preset: 'Scenario preset',
      preset_help: 'Editing options below will deselect the preset.',
      game_rules: 'Game Rules',
      weeks: 'Total weeks', order_delay: 'Order delay (weeks)', ship_delay: 'Ship delay (weeks)',
      start_inv: 'Starting inventory',
      hold_cost: 'Holding cost ($/unit/week)', back_cost: 'Backlog cost ($/unit/week)',
      demand_pattern: 'Customer demand pattern',
      info_mode: 'Information mode',
      info_full: 'Full (adjacent only — MIT classic)',
      info_partial: 'Partial (own tier only)',
      info_open: 'Open (all information shared)',
      ai_policy: 'AI policy (decision-making for empty seats)',
      submit: 'Create Session',
      submitting: 'Creating...'
    }
  }
};

export const LOCALES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' }
];

export const DEFAULT_LOCALE = 'ko';
