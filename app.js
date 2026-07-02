const app = document.getElementById("app");

const state = {
  user: null,
  view: "home",
  error: "",
  aiText: "",
  selectedDept: "",
  selectedPerson: "",
  expandedDepts: ["bfe"],
  modal: null,
  api: {
    online: false,
    token: "",
    message: "后端未连接，静态展示模式"
  },
  audit: [
    {
      time: "2026-07-01 09:00",
      category: "系统",
      actor: "系统",
      action: "加载配置",
      object: "Demo 配置",
      before: "无",
      after: "6 类来源系统、6 类角色、18 个应用入口",
      impact: "初始化工作台能力",
      status: "成功"
    },
    {
      time: "2026-07-01 09:01",
      category: "权限",
      actor: "系统",
      action: "启用权限策略",
      object: "权限模型",
      before: "未启用",
      after: "通用入口全员可见，专属入口按角色和数据范围展示",
      impact: "控制入口、数据、文档与人员画像可见范围",
      status: "成功"
    }
  ]
};

const systemSources = {
  wecom: { name: "企微", mode: "link" },
  finance: { name: "财务系统", mode: "mock" },
  hr: { name: "人事系统", mode: "mock" },
  project: { name: "项目系统", mode: "mock" },
  recruiting: { name: "招聘工具", mode: "mock" },
  legal: { name: "法务系统", mode: "mock" },
  ai_workbench: { name: "AI 工作台", mode: "native" }
};

const contractApprovalStages = [
  { key: "submitted", label: "员工提交", owner: "员工" },
  { key: "ai_review", label: "合同审批助理 AI 预审", owner: "合同审批助理" },
  { key: "mentor_review", label: "带教/主管审核", owner: "主管" },
  { key: "legal_review", label: "法务审核", owner: "法务接口人" },
  { key: "assistant_review", label: "总助复核", owner: "总助" },
  { key: "boss_review", label: "老板终审", owner: "老板" },
  { key: "archived", label: "归档/抄送", owner: "系统" }
];

const managerAccount = {
  password: "123456",
  name: "主管",
  role: "manager",
  roleName: "主管",
  department: "产品及运营部",
  departmentCode: "product",
  position: "部门主管",
  manager: "老板",
  scope: "本人 + 团队 + 负责项目"
};

const accounts = {
  employee: {
    password: "123456",
    name: "员工",
    role: "employee",
    roleName: "普通员工",
    department: "产品及运营部",
    departmentCode: "product",
    position: "CPD 专员",
    manager: "主管",
    scope: "本人数据"
  },
  manager: managerAccount,
  manger: managerAccount,
  hr: {
    password: "123456",
    name: "HR",
    role: "hr",
    roleName: "HR",
    department: "人力行政部",
    departmentCode: "hr",
    position: "HRBP",
    manager: "老板",
    scope: "全员人事数据"
  },
  finance: {
    password: "123456",
    name: "财务",
    role: "finance",
    roleName: "财务",
    department: "财务部",
    departmentCode: "finance",
    position: "财务专员",
    manager: "老板",
    scope: "财务相关数据"
  },
  legal: {
    password: "123456",
    name: "法务接口人",
    role: "legal",
    roleName: "法务",
    department: "法务",
    departmentCode: "legal",
    position: "法务接口人",
    manager: "老板",
    scope: "合同模板、风险意见、归档合同"
  },
  assistant: {
    password: "123456",
    name: "总助",
    role: "assistant",
    roleName: "总助",
    department: "总裁办",
    departmentCode: "ceo_office",
    position: "总经理助理",
    manager: "老板",
    scope: "全局组织与授权管理"
  },
  boss: {
    password: "123456",
    name: "老板",
    role: "boss",
    roleName: "老板",
    department: "总裁办",
    departmentCode: "ceo_office",
    position: "总经理",
    manager: "无",
    scope: "全局汇总 + 授权明细"
  }
};

const orgDepartments = [
  {
    code: "bfe",
    parentCode: null,
    name: "贝法易集团 / 出口易",
    lead: "肖友泉",
    members: ["肖友泉"],
    docs: ["企业文化", "组织通讯录", "制度公告"],
    dataScope: "公司公开组织信息",
    workflow: "组织查看、通讯录、制度公告",
    note: "根组织只展示公开信息；真实层级以后以企微通讯录 parentid 为准。"
  },
  {
    code: "strategy_committee",
    parentCode: "bfe",
    name: "战略委员会",
    lead: "肖友泉",
    members: ["老板"],
    docs: ["战略方向", "经营事项记录", "重大事项清单"],
    dataScope: "战略与经营汇总",
    workflow: "战略督办、重大事项决策",
    note: "战略委员会属于高敏组织节点，仅展示公开层级，具体资料按授权查看。"
  },
  {
    code: "ceo_office",
    parentCode: "bfe",
    name: "总裁办",
    lead: "老板",
    members: ["老板", "总助"],
    docs: ["组织授权台账", "关键项目督办", "经营风险清单"],
    dataScope: "全局组织、关键项目、风险与授权明细",
    workflow: "组织调整、权限交接、老板督办",
    note: "老板和总助可维护组织架构，所有调整必须留痕。"
  },
  {
    code: "hr",
    parentCode: "ceo_office",
    name: "HR",
    lead: "HR",
    members: ["HR"],
    docs: ["员工档案", "入职材料", "转正记录", "招聘画像库"],
    dataScope: "员工生命周期、招聘流程、组织基础信息",
    workflow: "入职、转正、调岗、离职、招聘协同",
    note: "HR 可维护人事字段，组织调整权限需另行授权。"
  },
  {
    code: "admin",
    parentCode: "ceo_office",
    name: "行政",
    lead: "行政",
    members: ["行政"],
    docs: ["会议室规则", "物资台账", "行政供应商"],
    dataScope: "行政资源与服务事项",
    workflow: "会议室、物资、行政申请",
    note: "会议室等高频行政能力可搬到工作台入口。"
  },
  {
    code: "pr",
    parentCode: "ceo_office",
    name: "PR",
    lead: "PR 负责人",
    members: ["PR 负责人"],
    docs: ["品牌资料", "对外口径", "活动资料"],
    dataScope: "品牌与传播资料",
    workflow: "品牌审核、活动协同",
    note: "PR 资料默认只对职能与授权项目开放。"
  },
  {
    code: "legal",
    parentCode: "ceo_office",
    name: "法务",
    lead: "法务接口人",
    members: ["法务接口人", "外部律师"],
    docs: ["合同模板", "风险意见", "归档合同", "持续风控清单"],
    dataScope: "合同审批、AI 风险备注、法务意见",
    workflow: "合同上传、AI 风险备注、逐级审批",
    note: "合同内容按项目、部门和授权范围开放。"
  },
  {
    code: "investment",
    parentCode: "ceo_office",
    name: "投资孵化",
    lead: "投资孵化负责人",
    members: ["投资孵化负责人"],
    docs: ["孵化项目清单", "投后跟进", "商业计划资料"],
    dataScope: "投资孵化项目",
    workflow: "项目评估、投后跟进",
    note: "投资孵化资料属于敏感资料，需单独授权。"
  },
  {
    code: "finance",
    parentCode: "ceo_office",
    name: "财务部",
    lead: "财务主管",
    members: ["财务主管", "财务"],
    docs: ["报销规范", "发票台账", "付款资料", "费用归类表"],
    dataScope: "报销、发票、付款、项目费用",
    workflow: "报销审核、付款审批、发票异常处理",
    note: "财务明细只对财务和授权管理层开放。"
  },
  {
    code: "finance_fund",
    parentCode: "finance",
    name: "资金",
    lead: "财务主管",
    members: ["财务主管"],
    docs: ["资金计划", "付款排期"],
    dataScope: "资金计划与付款节奏",
    workflow: "付款排期、资金审批",
    note: "资金相关数据高敏，默认仅财务和授权管理层可见。"
  },
  {
    code: "finance_ar",
    parentCode: "finance",
    name: "应收",
    lead: "财务主管",
    members: ["财务主管"],
    docs: ["应收台账", "客户回款"],
    dataScope: "应收数据",
    workflow: "应收跟进、回款核对",
    note: "应收数据默认仅财务授权可见。"
  },
  {
    code: "finance_ap",
    parentCode: "finance",
    name: "应付结算",
    lead: "财务",
    members: ["财务"],
    docs: ["应付台账", "结算资料", "发票资料"],
    dataScope: "应付结算与发票",
    workflow: "应付结算、发票异常处理",
    note: "应付结算与报销、发票能力关联。"
  },
  {
    code: "technology",
    parentCode: "bfe",
    name: "技术部",
    lead: "技术负责人",
    members: ["技术负责人"],
    docs: ["技术规划", "系统权限说明", "接口文档"],
    dataScope: "技术项目、系统权限、接口状态",
    workflow: "系统建设、接口对接、权限支持",
    note: "技术部下挂产品与 BP、框架平台、AI 创新、业务交付、运维保障等。"
  },
  {
    code: "tech_ai",
    parentCode: "technology",
    name: "AI 创新",
    lead: "技术负责人",
    members: ["技术负责人"],
    docs: ["AI 工作台方案", "智能体流程", "模型调用记录"],
    dataScope: "AI 项目和能力建设",
    workflow: "AI 能力建设、智能流程接入",
    note: "AI 创新节点服务工作台后续能力。"
  },
  {
    code: "tech_delivery",
    parentCode: "technology",
    name: "业务交付",
    lead: "技术负责人",
    members: ["技术负责人"],
    docs: ["交付计划", "需求排期", "验收记录"],
    dataScope: "项目交付进度",
    workflow: "需求交付、验收闭环",
    note: "业务交付节点与项目管理、验收日志相关。"
  },
  {
    code: "business_development",
    parentCode: "bfe",
    name: "业务发展",
    lead: "业务发展负责人",
    members: ["业务发展负责人"],
    docs: ["业务策略", "客户分层", "市场资料"],
    dataScope: "客户、销售、市场与客户成功",
    workflow: "客户跟进、市场活动、客户成功协同",
    note: "业务发展下挂支持管理、市场营销、KA、CBD、客户成功、CS 等。"
  },
  {
    code: "sales",
    parentCode: "business_development",
    name: "销售组",
    lead: "销售主管",
    members: ["销售主管", "销售员工", "销售顾问"],
    docs: ["客户资料", "报价模板", "渠道政策", "销售 SOP"],
    dataScope: "客户线索、销售机会、合同跟进",
    workflow: "客户跟进、报价申请、销售合同协同",
    note: "销售组默认只能访问销售文档；项目授权可临时放开。"
  },
  {
    code: "customer_success",
    parentCode: "business_development",
    name: "客户成功",
    lead: "业务发展负责人",
    members: ["业务发展负责人"],
    docs: ["客户成功 SOP", "续约跟进", "客户反馈"],
    dataScope: "客户成功与续约数据",
    workflow: "客户反馈、续约跟进、满意度跟踪",
    note: "客户成功数据按客户归属和项目授权查看。"
  },
  {
    code: "product",
    parentCode: "bfe",
    name: "产品及运营部",
    lead: "主管",
    members: ["主管", "员工", "CPD 专员"],
    docs: ["产品需求文档", "运营 SOP", "项目复盘", "校园招聘 PPT"],
    dataScope: "产品任务、项目进度、运营数据",
    workflow: "项目立项、任务分工、月度总结、转正协同",
    note: "产品组默认只能访问产品与项目文档。"
  },
  {
    code: "product_ops",
    parentCode: "product",
    name: "产品运营组",
    lead: "产品运营负责人",
    members: ["产品运营负责人", "CPD 专员"],
    docs: ["产品运营 SOP", "数据看板", "区域运营资料"],
    dataScope: "产品运营与区域运营数据",
    workflow: "产品运营、区域运营、售后运营协同",
    note: "产品运营组属于产品及运营部下级。"
  },
  {
    code: "international_transport",
    parentCode: "bfe",
    name: "国际运输部",
    lead: "运力负责人",
    members: ["运力负责人"],
    docs: ["运输线路", "渠道价格", "清关方案"],
    dataScope: "国际运输与渠道数据",
    workflow: "运输方案、渠道协同",
    note: "渠道价格和清关方案属于保密资料。"
  },
  {
    code: "capacity_center",
    parentCode: "bfe",
    name: "运力中心",
    lead: "运力负责人",
    members: ["运力负责人"],
    docs: ["运力资源", "包机协议", "渠道容量"],
    dataScope: "运力资源与供应商",
    workflow: "运力排期、资源协调",
    note: "运力中心资料按授权范围查看。"
  },
  {
    code: "warehouse_ops",
    parentCode: "bfe",
    name: "仓储操作中心",
    lead: "仓储负责人",
    members: ["仓储负责人"],
    docs: ["仓储 SOP", "操作排班", "异常件记录"],
    dataScope: "仓储操作与异常",
    workflow: "仓储操作、异常处理",
    note: "仓储数据按区域和岗位授权查看。"
  },
  {
    code: "others",
    parentCode: "bfe",
    name: "其他（待设置部门）",
    lead: "总助",
    members: ["总助"],
    docs: ["待归类部门清单"],
    dataScope: "待配置组织数据",
    workflow: "部门归类、组织调整",
    note: "用于承接企微中待整理的部门节点。"
  }
];

const employeeProfiles = {
  "老板": profile("老板", "总裁办", "ceo_office", "老板", "无", ["组织治理", "关键项目", "风险判断"], "全局经营管理", "关注组织权限、关键项目、招聘体系和风险闭环。", "管理层账号，可查看全局汇总和授权明细。", 98, "全局视角", "老板视角不展示个人绩效评定。"),
  "总助": profile("总助", "总裁办", "ceo_office", "总助", "老板", ["组织协调", "权限治理", "督办"], "组织架构维护、权限交接、老板督办", "适合作为组织变更发起人与交接推进人。", "交接时重点检查旧权限回收、新权限开通和资料归档。", 93, "组织治理", "可调整组织架构并触发权限交接。"),
  "主管": profile("主管", "产品及运营部", "product", "主管", "老板", ["项目管理", "产品规划", "人员辅导"], "团队待办、项目进度、转正访谈", "负责团队协同和项目推进。", "接收新成员时需查看历史项目、能力标签和偏离提醒。", 91, "团队项目完成率 82%", "需关注项目延期风险。"),
  "员工": profile("员工", "产品及运营部", "product", "员工", "主管", ["执行力", "PPT 整理", "项目协作"], "校园招聘项目、月度总结、转正流程", "试用期员工，本月工作量化已生成，适合用于转正访谈参考。", "主管交接时查看项目事项、月度总结、转正提醒和偏离判断。", 86, "本月完成 14 个事项", "需确认是否偏离岗位培养方向。"),
  "HR": profile("HR", "HR", "hr", "HR", "老板", ["招聘体系", "员工生命周期", "组织信息维护"], "入职、转正、调岗、离职、招聘流程", "负责招聘体系化搭建与人事流程维护。", "主管交接时可提供员工档案、面谈记录和试用期记录。", 89, "招聘漏斗 118 人", "人事敏感信息需按授权展示。"),
  "财务主管": profile("财务主管", "财务部", "finance", "财务主管", "老板", ["财务审核", "流程规范", "费用风控"], "报销审核、付款、费用归类", "负责财务流程规范和异常费用识别。", "交接时需查看付款权限、发票台账和费用归类规则。", 90, "异常发票跟进 6 单", "高敏权限，调整需审计。"),
  "财务": profile("财务", "财务部", "finance", "财务", "财务主管", ["费用审核", "发票识别", "项目费用归类"], "报销审核、发票异常、项目费用", "负责日常费用审核和项目费用归类。", "交接时需回收旧部门私有文档，保留已授权项目费用资料。", 84, "本月报销处理 31 单", "调岗期间存在旧权限未回收风险。"),
  "销售主管": profile("销售主管", "销售组", "sales", "销售主管", "老板", ["客户拓展", "报价策略", "合同跟进"], "客户线索、报价、销售合同", "客户资源集中，交接时需明确客户归属和历史沟通。", "新主管需重点确认客户资料、报价模板和渠道政策权限。", 88, "客户进展稳定", "存在客户资料敏感性，跨部门访问需项目授权。"),
  "销售员工": profile("销售员工", "销售组", "sales", "销售员工", "销售主管", ["客户跟进", "商机记录", "报价协同"], "客户拜访、线索跟进", "适合继续负责区域客户线索。", "交接时重点查看客户跟进记录和报价版本。", 79, "线索跟进偏慢", "需要主管确认重点客户优先级。"),
  "销售顾问": profile("销售顾问", "销售组", "sales", "销售顾问", "销售主管", ["客户跟进", "报价协同", "合同协同"], "客户跟进和报价协同", "用于演示销售岗位人员画像。", "交接时重点确认客户资料和报价版本。", 80, "销售协作正常", "客户资料需授权。"),
  "CPD 专员": profile("CPD 专员", "产品运营组", "product_ops", "CPD 专员", "主管", ["运营执行", "数据整理", "跨部门协作"], "运营 SOP、项目复盘", "日常执行稳定，可承担资料整理和流程固化。", "交接时确认项目文档和运营 SOP 权限。", 82, "项目协作正常", "暂无明显风险。"),
  "行政": profile("行政", "行政", "admin", "行政", "总助", ["会议室", "物资", "行政流程"], "会议室、行政申请、物资支持", "适合处理会议室和行政支持类事项。", "交接时确认会议室、物资和行政供应商资料。", 78, "行政事项响应正常", "低频行政权限不进入首页。"),
  "技术负责人": profile("技术负责人", "技术部", "technology", "技术负责人", "老板", ["系统架构", "接口对接", "权限支持"], "技术规划、系统建设、接口打通", "负责把工作台与企微、财务、人事、项目等系统逐步打通。", "交接时重点确认系统权限、接口文档和上线风险。", 90, "接口梳理中", "技术权限变更需走审计。"),
  "业务发展负责人": profile("业务发展负责人", "业务发展", "business_development", "业务发展负责人", "老板", ["客户拓展", "市场策略", "客户成功"], "业务发展、客户成功和市场协同", "负责业务发展下属销售、KA、CBD、客户成功等方向。", "交接时重点确认客户归属、报价权限和历史沟通。", 88, "客户推进稳定", "客户资料为敏感数据。"),
  "产品运营负责人": profile("产品运营负责人", "产品运营组", "product_ops", "产品运营负责人", "主管", ["产品运营", "区域协同", "数据复盘"], "产品运营、区域运营和售后运营协同", "负责产品运营 SOP 和区域运营资料沉淀。", "交接时重点确认 SOP、项目复盘和数据口径。", 86, "运营事项正常", "需保持文档版本一致。"),
  "PR 负责人": profile("PR 负责人", "PR", "pr", "PR 负责人", "总助", ["品牌口径", "活动传播", "对外协同"], "品牌资料和对外口径管理", "负责品牌资料、活动传播和对外信息一致性。", "交接时重点确认品牌资料版本和对外口径。", 82, "PR 资料维护中", "对外材料需审批。"),
  "投资孵化负责人": profile("投资孵化负责人", "投资孵化", "investment", "投资孵化负责人", "总助", ["项目评估", "投后跟进", "商业分析"], "孵化项目和投后跟进", "负责投资孵化项目的资料和节点跟进。", "交接时重点确认项目授权、投后资料和跟进记录。", 84, "孵化项目跟进中", "投融资资料高敏。"),
  "运力负责人": profile("运力负责人", "运力中心", "capacity_center", "运力负责人", "老板", ["渠道资源", "运力协调", "运输方案"], "国际运输与运力资源协调", "交接时重点确认渠道价格、包机协议和供应商资料。", "渠道价格属于保密信息。", 87, "运力事项正常", "渠道价格属于保密信息。"),
  "仓储负责人": profile("仓储负责人", "仓储操作中心", "warehouse_ops", "仓储负责人", "老板", ["仓储操作", "异常处理", "排班协调"], "仓储操作和异常件处理", "负责仓储 SOP、操作排班和异常件闭环。", "交接时重点确认仓储 SOP、异常记录和区域权限。", 83, "仓储异常可控", "仓储数据按区域授权。"),
  "法务接口人": profile("法务接口人", "法务组", "legal", "法务接口人", "老板", ["合同审核", "风险提示", "归档"], "合同审批、风险意见、持续风控", "负责合同风险意见和归档跟踪。", "交接时确认合同模板、风险意见和持续风控清单。", 87, "合同风险意见 4 单", "合同资料按项目授权。"),
  "外部律师": profile("外部律师", "法务组", "legal", "外部顾问", "法务接口人", ["法律审查", "争议处理", "合同条款"], "外部法务支持", "仅在授权事项内参与法务协作。", "交接时确认授权范围和资料脱敏。", 75, "按事项协作", "不应开放公司内部全量资料。")
};

const approvalEntries = [
  entry("reimburse", "报销", "财务/企微", "wecom", "BX", "expense", "本人申请；财务看全部"),
  entry("leave", "请假", "企微审批", "wecom", "QJ", "leave", "本人申请；主管看团队"),
  entry("contract-approval", "合同审批", "企微审批/AI 风控", "legal", "HT", "contract", "上传合同后 AI 先读全文并写入风险备注"),
  entry("field", "外勤", "企微审批", "wecom", "WQ", "field", "本人申请；主管/HR 查看"),
  entry("travel", "出差", "企微审批", "wecom", "CC", "travel", "本人申请；财务看费用"),
  entry("punch-fix", "补卡", "企微审批", "wecom", "BK", "attendance", "本人申请；主管/HR 查看"),
  entry("admin-apply", "行政申请", "企微审批", "wecom", "XZ", "approval", "物资/用车/行政支持"),
  entry("payment-apply", "付款申请", "财务/企微", "finance", "FK", "payment", "按权限进入财务审核")
];

const commonEntries = [
  entry("approval-center", "审批中心", "企微审批", "wecom", "SP", "approval_center", "请假/报销/外勤/出差等统一入口"),
  entry("meeting-room", "会议室", "企微应用", "wecom", "HY", "meeting", "会议室预订与占用"),
  entry("permission", "权限申请", "AI 工作台", "ai_workbench", "QX", "permission", "本人申请；主管处理"),
  entry("schedule", "日程", "企微日程", "wecom", "RC", "schedule", "会议/宣讲/面谈安排"),
  entry("my-approval", "我的审批", "企微审批", "wecom", "SP", "approval", "当前用户待审批"),
  entry("todo", "我的待办", "AI 工作台", "ai_workbench", "DB", "todo", "当前用户相关事项")
];

const roleEntries = {
  employee: [
    entry("my-projects", "我的项目", "项目系统", "project", "XM", "project", "参与项目")
  ],
  manager: [
    entry("team-todo", "团队待办", "AI 工作台", "ai_workbench", "TD", "todo", "本团队"),
    entry("probation-alert", "转正提醒", "人事系统", "hr", "ZZ", "probation", "本团队"),
    entry("work-deviation", "工作偏离提醒", "AI 量化", "hr", "PL", "work_deviation", "本团队"),
    entry("project-progress", "项目进度", "项目系统", "project", "JD", "project", "负责项目"),
    entry("handover", "人员交接", "人事系统", "hr", "JJ", "transfer", "本团队")
  ],
  hr: [
    entry("onboard", "入职", "人事系统", "hr", "RZ", "onboard", "全员人事"),
    entry("probation", "转正", "人事系统", "hr", "ZZ", "probation", "全员人事"),
    entry("transfer", "调岗", "人事系统", "hr", "DG", "transfer", "全员人事"),
    entry("resign", "离职", "人事系统", "hr", "LZ", "resign", "全员人事"),
    entry("employee-file", "员工档案", "人事系统", "hr", "DA", "hr_file", "全员人事"),
    entry("recruiting-flow", "招聘流程", "招聘工具", "recruiting", "ZP", "recruiting", "招聘数据")
  ],
  finance: [
    entry("expense-review", "报销审核", "财务系统", "finance", "SH", "expense_review", "全部财务"),
    entry("invoice", "发票", "财务系统", "finance", "FP", "invoice", "全部财务"),
    entry("payment", "付款", "财务系统", "finance", "FK", "payment", "授权财务"),
    entry("cost-class", "费用归类", "财务系统", "finance", "FY", "cost", "全部财务"),
    entry("project-cost", "项目费用", "财务/项目", "finance", "XM", "project_cost", "项目费用")
  ],
  legal: [
    entry("legal-risk", "风险意见", "法务系统", "legal", "FX", "risk", "合同风险"),
    entry("contract-archive", "合同归档", "法务系统", "legal", "GD", "legal", "归档合同"),
    entry("contract-template", "合同模板", "法务系统", "legal", "MB", "legal", "模板管理"),
    entry("continuous-risk", "持续风控", "法务系统", "legal", "FK", "risk", "履约风险")
  ],
  assistant: [
    entry("org-manage", "组织架构维护", "组织权限", "hr", "ZZ", "org_change", "全局组织"),
    entry("permission-handover", "权限交接", "AI 工作台", "ai_workbench", "JQ", "handover", "组织变更"),
    entry("boss-follow", "老板督办", "AI 工作台", "ai_workbench", "DB", "todo", "全局督办"),
    entry("key-projects", "关键项目", "项目系统", "project", "XM", "project", "关键项目")
  ],
  boss: [
    entry("org-manage", "组织架构维护", "组织权限", "hr", "ZZ", "org_change", "全局组织"),
    entry("org-health", "组织状态", "人事系统", "hr", "ZZ", "org", "全局汇总"),
    entry("key-projects", "关键项目", "项目系统", "project", "XM", "project", "关键项目"),
    entry("recruiting-system", "招聘体系化搭建", "招聘工具", "recruiting", "ZP", "recruiting", "全局查看/督办")
  ]
};

const digitalSkills = [
  skill("expense-assistant", "报销助理", "审批中心 / 报销", "receipt", "blue", "识别发票、费用类型、项目归属，生成报销草稿并交给本人确认。", "员工上传滴滴发票并备注校园招聘项目。", ["发票抬头与金额识别完成", "费用归类：招聘项目交通费", "建议附件命名：2026-07-02_校园招聘_滴滴_128元", "写回：报销审批草稿 + 事项中心"], "Workflow：OCR/结构化提取 -> 费用分类 -> 项目匹配 -> 人工确认 -> 审批草稿", "本人确认，财务最终审核", "报销审批、费用归类、项目费用"),
  skill("travel-field-assistant", "差旅外勤助理", "审批中心 / 外勤出差", "travel", "mint", "把自然语言行程转成外勤/出差申请，补齐时间、地点、预算和审批链。", "下周三去华南理工宣讲，需行政支持易拉宝和差旅。", ["识别类型：外勤 + 出差", "地点：华南理工大学；事项：校园宣讲", "提醒材料：PPT、易拉宝、参会人日程", "写回：外勤/出差审批 + 日程"], "Chatflow：意图识别 -> 表单补全 -> 日程冲突检查 -> 人工确认 -> 审批提交", "本人确认，主管审批", "外勤审批、出差审批、日程"),
  skill("weekly-report-assistant", "日报周报助理", "事项中心", "todo", "violet", "汇总事项、项目、审批和工作产出，生成日报/周报，标出偏离计划。", "主管查看团队本周事项完成情况和异常。", ["本周完成事项：14 项", "待跟进：合同风险意见、转正访谈", "偏离提醒：销售员工线索跟进低于计划", "写回：周报草稿 + 主管确认"], "Workflow：拉取事项/项目/审批 -> 摘要归类 -> 偏离判断 -> 主管确认 -> 月度量化沉淀", "本人或主管确认", "事项中心、月度工作量化"),
  skill("meeting-schedule-assistant", "日程和会议助理", "会议室 / 日程", "meeting", "orange", "协调参会人、会议室、材料和提醒，把会议动作写入日程。", "安排转正面谈或校园宣讲会前准备会。", ["建议时间：周二 10:00-10:30", "会议室：A 会议室可用", "材料提醒：转正量化记录、面谈问题、PPT", "写回：会议室预订 + 日程提醒"], "Chatflow：参会人识别 -> 空闲时间/会议室查询 -> 材料清单 -> 人工确认 -> 日程写回", "发起人确认", "会议室、企微日程"),
  skill("product-training-coach", "产品培训教练", "培训 / 知识库", "project", "mint", "基于产品资料和 SOP 做问答、学习路径和测验，帮助新人快速理解业务。", "新人询问出口易产品线、海外仓、专线、小包区别。", ["回答产品差异并给出处", "生成 5 道小测题", "标记薄弱知识点：海外仓场景", "写回：学习记录"], "Chatflow + RAG：知识检索 -> 引用回答 -> 测验生成 -> 学习记录", "员工自学，主管可看学习结果", "培训知识库、员工画像"),
  skill("system-training-coach", "系统培训教练", "培训 / 系统使用", "toolbox", "blue", "教员工怎么用工作台、企微审批、权限申请和事项中心。", "员工不知道报销、权限、合同审批应该从哪里发起。", ["推荐入口：审批中心 / 权限申请 / 合同审批", "展示步骤：上传材料 -> AI 预处理 -> 人工确认 -> 审批", "常见错误：资料缺失、项目未关联", "写回：培训完成记录"], "Chatflow：问题分类 -> 操作指引 -> 权限判断 -> 学习记录", "员工确认已学会", "系统培训、帮助中心"),
  skill("contract-approval-assistant", "合同审批助理", "审批中心 / 合同审批", "contract", "violet", "上传合同后先读全文，按低/中/高风险写入审批备注，再按阶段流转。老板不会第一时间看到。", "员工上传客户合同并提交审批。", ["低风险：主体、金额、签署信息完整", "中风险：付款节点与验收标准偏宽", "高风险：违约责任上限未明确", "写回：合同审批备注 + 当前审批阶段"], "Workflow：员工提交 -> AI 预审 -> 带教/主管审核 -> 法务审核 -> 总助复核 -> 老板终审 -> 归档", "带教/主管、法务、总助全部通过后，才进入老板终审", "合同审批、审批备注、事项中心"),
  skill("quote-assistant", "报价助理", "销售 / 报价", "card", "orange", "根据客户、渠道、服务产品和规则生成报价草案；一期只做演示，正式版必须接价格规则。", "销售输入客户目的地、服务产品和预计重量。", ["生成报价草案：待接入价格规则", "提醒：成本、利润底线、有效期需系统校验", "建议审批：销售主管确认后发送", "写回：报价草稿"], "Workflow + 规则引擎：客户/渠道识别 -> 价格规则 -> 毛利校验 -> 主管确认 -> 报价输出", "销售主管确认；价格规则未接入前不得自动发送", "报价系统、客户资料")
];

let tasks = [
  task("T-1001", "校园招聘项目立项与角色分工", "project", "project", "主管", "processing", "2026-07-08", "项目系统"),
  task("T-1002", "员工试用期转正评估", "probation", "hr", "主管", "pending", "2026-07-05", "人事系统"),
  task("T-1006", "员工月度工作量化低于阈值，请确认是否偏离计划", "work_deviation", "hr", "主管", "pending", "2026-07-06", "AI 工作台"),
  task("T-1007", "员工从销售支持组转入产品组，需完成权限交接", "org_change", "hr", "总助", "pending", "2026-07-06", "组织权限"),
  task("T-1003", "滴滴发票报销归入校园招聘项目", "expense", "finance", "财务", "need_info", "2026-07-03", "财务系统"),
  contractTask("T-1004", "客户合同已完成 AI 预审，待带教/主管审核", "主管", "pending", "2026-07-04", "mentor_review", "员工", "AI 已写入低/中/高风险备注，暂不进入老板待办。"),
  task("T-1008", "合同归档风险意见复核", "legal", "legal", "法务接口人", "pending", "2026-07-05", "法务系统"),
  task("T-1005", "CPD 岗位人才画像和胜任力模型", "recruiting", "recruiting", "HR", "processing", "2026-07-10", "招聘工具")
];

const recruitingFunnel = [
  ["智能打招呼", 320],
  ["收到简历", 118],
  ["AI 初筛", 64],
  ["DISC 测评", 31],
  ["面试", 18],
  ["Offer", 6],
  ["入职", 3]
];

function entry(id, name, sourceName, source, icon, taskType, scope) {
  return { id, name, sourceName, source, icon, taskType, scope };
}

function profile(name, department, departmentCode, position, manager, tags, currentWork, summary, handover, score, monthly, risk) {
  return { name, department, departmentCode, position, manager, tags, currentWork, summary, handover, score, monthly, risk };
}

function task(id, title, type, source, owner, status, due, sourceName) {
  return { id, title, type, source, owner, status, due, sourceName, initiator: "系统", result: "" };
}

function contractTask(id, title, owner, status, due, approvalStage, initiator, result) {
  return {
    ...task(id, title, "contract", "legal", owner, status, due, "合同审批"),
    initiator,
    approvalStage,
    result
  };
}

function skill(id, name, scene, icon, tone, summary, sampleInput, output, workflow, humanGate, writeBack) {
  return { id, name, scene, icon, tone, summary, sampleInput, output, workflow, humanGate, writeBack };
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sourceStyle(source) {
  return "";
}

function uiIcon(name) {
  const icons = {
    app: `<rect x="4" y="4" width="6" height="6" rx="1.5"></rect><rect x="14" y="4" width="6" height="6" rx="1.5"></rect><rect x="4" y="14" width="6" height="6" rx="1.5"></rect><rect x="14" y="14" width="6" height="6" rx="1.5"></rect>`,
    home: `<path d="M4 11.5 12 5l8 6.5"></path><path d="M6.5 10.5V20h11v-9.5"></path><path d="M10 20v-5h4v5"></path>`,
    tasks: `<path d="M8 5h8"></path><rect x="6" y="3" width="12" height="18" rx="3"></rect><path d="m9 12 2 2 4-4"></path><path d="M9 17h6"></path>`,
    org: `<path d="M12 5v4"></path><rect x="8" y="3" width="8" height="4" rx="1.5"></rect><path d="M6 13h12"></path><path d="M6 13v4"></path><path d="M18 13v4"></path><path d="M12 9v8"></path><rect x="3.5" y="17" width="5" height="4" rx="1.4"></rect><rect x="9.5" y="17" width="5" height="4" rx="1.4"></rect><rect x="15.5" y="17" width="5" height="4" rx="1.4"></rect>`,
    recruiting: `<path d="M15 20v-1.6c0-1.8-1.6-3.2-3.6-3.2H7.6c-2 0-3.6 1.4-3.6 3.2V20"></path><circle cx="9.5" cy="8" r="3.2"></circle><path d="M18 8v6"></path><path d="M15 11h6"></path>`,
    permission: `<path d="M12 3.5 19 6v5.2c0 4.1-2.8 7.8-7 9.3-4.2-1.5-7-5.2-7-9.3V6l7-2.5Z"></path><path d="M9.5 12.2 11.3 14l3.5-4"></path>`,
    approval: `<path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"></path><path d="m8.5 12 2.2 2.2 4.8-5"></path>`,
    meeting: `<rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M8 3v4"></path><path d="M16 3v4"></path><path d="M4 10h16"></path><path d="M8 14h3"></path><path d="M13 14h3"></path>`,
    key: `<circle cx="8" cy="12" r="3.5"></circle><path d="M11.5 12H21"></path><path d="M17 12v3"></path><path d="M20 12v2"></path>`,
    clock: `<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3.2 2"></path>`,
    inbox: `<path d="M4 13 7 5h10l3 8"></path><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"></path><path d="M8 13h2.5l1.5 2 1.5-2H16"></path>`,
    todo: `<path d="M8 7h12"></path><path d="M8 12h12"></path><path d="M8 17h12"></path><path d="m3.8 7 1 1 1.6-2"></path><path d="m3.8 12 1 1 1.6-2"></path><path d="m3.8 17 1 1 1.6-2"></path>`,
    receipt: `<path d="M7 3h10v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3Z"></path><path d="M9.5 8h5"></path><path d="M9.5 12h5"></path><path d="M9.5 16h3"></path>`,
    leave: `<rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M8 3v4"></path><path d="M16 3v4"></path><path d="m8 14 2.2 2.2L16 10.5"></path>`,
    contract: `<path d="M7 3h7l4 4v14H7V3Z"></path><path d="M14 3v5h5"></path><path d="M9.5 12h5"></path><path d="M9.5 15.5h6.5"></path><path d="M9.5 19h4"></path>`,
    map: `<path d="M12 21s6-5.1 6-10a6 6 0 0 0-12 0c0 4.9 6 10 6 10Z"></path><circle cx="12" cy="11" r="2.2"></circle>`,
    travel: `<path d="M3 12h18"></path><path d="m13 5 7 7-7 7"></path><path d="M4 7h5l3 5-3 5H4"></path>`,
    card: `<rect x="3.5" y="6" width="17" height="12" rx="3"></rect><path d="M3.5 10h17"></path><path d="M7 15h4"></path>`,
    toolbox: `<path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"></path><rect x="4" y="7" width="16" height="12" rx="3"></rect><path d="M4 12h16"></path><path d="M12 11v3"></path>`,
    project: `<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"></path><path d="M8 13h8"></path><path d="M8 16h5"></path>`,
    people: `<path d="M16 20v-1.3c0-1.8-1.5-3.2-3.4-3.2H7.4C5.5 15.5 4 16.9 4 18.7V20"></path><circle cx="10" cy="8" r="3"></circle><path d="M20 20v-1.1c0-1.4-1-2.6-2.4-3"></path><path d="M16.5 5.4a3 3 0 0 1 0 5.2"></path>`,
    alert: `<path d="M12 4 21 20H3L12 4Z"></path><path d="M12 9.5v4"></path><path d="M12 17h.01"></path>`,
    file: `<path d="M7 3h7l4 4v14H7V3Z"></path><path d="M14 3v5h5"></path>`,
    search: `<circle cx="10.5" cy="10.5" r="5.5"></circle><path d="m15 15 5 5"></path>`,
    bell: `<path d="M18 8.5a6 6 0 0 0-12 0c0 7-3 7-3 8.8h18c0-1.8-3-1.8-3-8.8Z"></path><path d="M9.8 20a2.4 2.4 0 0 0 4.4 0"></path>`,
    help: `<circle cx="12" cy="12" r="9"></circle><path d="M9.6 9a2.8 2.8 0 0 1 5.3 1.2c0 2-2.9 2.2-2.9 4"></path><path d="M12 17.5h.01"></path>`,
    "chevron-down": `<path d="m7 10 5 5 5-5"></path>`,
    "arrow-right": `<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>`,
    robot: `<rect x="5" y="7" width="14" height="11" rx="3"></rect><path d="M12 7V4"></path><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><path d="M9.5 16h5"></path>`
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.app}</svg>`;
}

function navIconName(view) {
  return {
    home: "home",
    tasks: "tasks",
    org: "org",
    recruiting: "recruiting",
    permission: "permission"
  }[view] || "app";
}

function entryIconName(item) {
  const byId = {
    "approval-center": "approval",
    reimburse: "receipt",
    leave: "leave",
    "contract-approval": "contract",
    field: "map",
    travel: "travel",
    "punch-fix": "clock",
    "admin-apply": "toolbox",
    "payment-apply": "card",
    "meeting-room": "meeting",
    permission: "key",
    schedule: "clock",
    "my-approval": "inbox",
    todo: "todo",
    onboard: "people",
    probation: "clock",
    transfer: "org",
    resign: "file",
    "employee-file": "file",
    "recruiting-flow": "recruiting",
    invoice: "receipt",
    payment: "card",
    "cost-class": "receipt",
    "project-cost": "project",
    "org-manage": "org",
    "org-health": "org",
    "permission-handover": "permission",
    "boss-follow": "todo",
    "key-projects": "project",
    "recruiting-system": "recruiting",
    "team-todo": "todo",
    "probation-alert": "clock",
    "work-deviation": "alert",
    "project-progress": "project",
    handover: "people",
    "my-projects": "project"
  };
  const byType = {
    expense: "receipt",
    contract: "contract",
    legal: "contract",
    risk: "alert",
    recruiting: "recruiting",
    project: "project",
    permission: "key",
    schedule: "clock",
    meeting: "meeting",
    todo: "todo",
    payment: "card",
    org_change: "org",
    transfer: "org",
    probation: "clock",
    hr_file: "file"
  };
  return byId[item.id] || byType[item.taskType] || "app";
}

function visibleTasks(user) {
  if (!user) return [];
  return tasks.filter((item) => canSeeTask(user, item));
}

function canSeeTask(user, item) {
  if (isContractApprovalTask(item)) return canSeeContractTask(user, item);
  if (user.role === "boss") return true;
  if (user.role === "assistant") return ["org_change", "handover"].includes(item.type) || ["hr", "project", "ai_workbench"].includes(item.source);
  if (user.role === "finance") return item.source === "finance" || item.type === "expense";
  if (user.role === "legal") return item.source === "legal" || ["legal", "risk"].includes(item.type);
  if (user.role === "hr") return ["hr", "recruiting"].includes(item.source) || ["probation", "onboard", "transfer"].includes(item.type);
  if (user.role === "manager") return ["project", "hr", "ai_workbench"].includes(item.source);
  return ["finance", "ai_workbench"].includes(item.source) || item.initiator === user.name;
}

function isContractApprovalTask(item) {
  return item.type === "contract" || Boolean(item.approvalStage);
}

function canSeeContractTask(user, item) {
  if (item.initiator === user.name || item.initiator === user.username) return true;
  const stage = item.approvalStage || "mentor_review";
  if (["submitted", "ai_review"].includes(stage)) return false;
  if (stage === "mentor_review") return user.role === "manager";
  if (stage === "legal_review") return user.role === "legal";
  if (stage === "assistant_review") return user.role === "assistant";
  if (stage === "boss_review") return ["boss", "assistant"].includes(user.role);
  if (stage === "archived") return ["boss", "assistant", "manager", "legal"].includes(user.role);
  return false;
}

function roleSpecificEntries(user) {
  return roleEntries[user.role] || [];
}

function render() {
  if (!state.user) {
    renderLogin();
    return;
  }
  renderWorkbench();
}

function renderLogin() {
  app.className = "app-shell";
  app.innerHTML = `
    <section class="login-view">
      <div class="login-panel">
        <div class="login-inner">
          <div class="brand-row">
            <img class="brand-logo" src="./assets/chukouyi-logo.png" alt="出口易 logo" />
            <div>
              <p class="eyebrow">Chukou1</p>
              <h2>出口易 AI 工作台</h2>
            </div>
          </div>
          <h1>欢迎登录</h1>
          <p class="login-copy">请使用账号密码进入工作台。</p>
          <form class="login-form" id="loginForm">
            <label class="field">
              <span>账号</span>
              <input id="username" autocomplete="username" placeholder="请输入账号" />
            </label>
            <label class="field">
              <span>密码</span>
              <input id="password" type="password" autocomplete="current-password" placeholder="请输入密码" />
            </label>
            <button class="primary-btn" type="submit">登录</button>
            <div class="login-error">${escapeHTML(state.error)}</div>
          </form>
        </div>
      </div>
    </section>
  `;

  document.getElementById("loginForm").addEventListener("submit", handleLogin);
}

function previewTile(code, title, text, color) {
  return `
    <div class="preview-tile">
      <span class="tile-code ${color}">${code}</span>
      <h3>${escapeHTML(title)}</h3>
      <p class="panel-note">${escapeHTML(text)}</p>
    </div>
  `;
}

function canUseBackend() {
  return ["http:", "https:"].includes(window.location.protocol);
}

async function apiRequest(path, options = {}) {
  if (!canUseBackend()) throw new Error("当前不是后端服务地址");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (state.api.token) headers.Authorization = `Bearer ${state.api.token}`;
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return response.json();
}

async function loginViaBackend(username, password) {
  try {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    state.api.online = true;
    state.api.token = payload.token;
    state.api.message = "后端已连接，提交会写入接口流程";
    return payload.user;
  } catch (error) {
    state.api.online = false;
    state.api.token = "";
    state.api.message = canUseBackend() ? `后端未连接：${error.message}` : "本地文件打开，后端未连接";
    return null;
  }
}

function finishLogin(account, username) {
  state.user = { ...account, username };
  state.error = "";
  state.view = "home";
  state.selectedDept = account.departmentCode;
  state.selectedPerson = account.name;
  state.expandedDepts = departmentPathCodes(account.departmentCode);
  state.modal = null;
  addAudit("登录工作台", {
    category: "访问",
    object: account.roleName,
    before: "未登录",
    after: `加载 ${account.roleName} 工作台`,
    impact: `数据范围：${account.scope}；${state.api.message}`
  });
  render();
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const backendUser = await loginViaBackend(username, password);
  if (backendUser) {
    finishLogin(backendUser, username);
    return;
  }
  const account = accounts[username];
  if (!account || account.password !== password) {
    state.error = "账号或密码错误。";
    renderLogin();
    return;
  }
  finishLogin(account, username);
}

function renderWorkbench() {
  app.className = "app-shell workbench";
  const user = state.user;
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand-row">
        <img class="brand-logo" src="./assets/chukouyi-logo.png" alt="出口易 logo" />
        <div>
          <p class="eyebrow">Chukou1</p>
          <h3>AI 工作台</h3>
        </div>
      </div>
      <nav class="side-nav">
        ${navButton("home", "首页", "SY")}
        ${navButton("tasks", "事项中心", "SX")}
        ${navButton("org", "组织架构", "ZZ")}
        ${navButton("recruiting", "招聘体系", "ZP")}
        ${navButton("permission", "权限管理", "QX")}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-visual" aria-hidden="true"></div>
        <div class="sidebar-tip">
          <strong>企业工作台</strong>
          <span>统一办事 · 权限联动</span>
        </div>
        <button class="ghost-btn" id="logoutBtn">退出登录</button>
      </div>
    </aside>
    <section class="main-area">
      <header class="app-toolbar">
        <div class="backend-pill ${state.api.online ? "online" : "offline"}">
          <span></span>
          ${escapeHTML(state.api.online ? "后端已连接" : "静态展示")}
        </div>
        <div class="toolbar-actions">
          <button class="round-tool has-badge" aria-label="通知">
            ${uiIcon("bell")}
            <span>3</span>
          </button>
          <button class="round-tool" aria-label="帮助">${uiIcon("help")}</button>
          <div class="user-mini">
            <div class="avatar">${escapeHTML(user.name.slice(0, 1))}</div>
            <div>
              <strong>${escapeHTML(user.name)}</strong>
              <span>${escapeHTML(user.department)}</span>
            </div>
            ${uiIcon("chevron-down")}
          </div>
        </div>
      </header>
      ${renderCurrentView()}
      ${renderModal()}
    </section>
  `;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "recruiting" && !["boss", "hr", "manager"].includes(state.user.role)) {
        addAudit("普通员工尝试访问招聘体系，被权限拦截。");
        alert("当前角色无权访问招聘体系看板。");
        return;
      }
      state.view = button.dataset.view;
      render();
    });
  });
  document.getElementById("logoutBtn").addEventListener("click", () => {
    state.user = null;
    state.view = "home";
    render();
  });
  bindViewEvents();
  bindPointerGlow();
}

function navButton(view, label, icon) {
  return `
    <button class="nav-btn ${state.view === view ? "active" : ""}" data-view="${view}">
      <span class="nav-icon">${uiIcon(navIconName(view))}</span>
      <span>${label}</span>
    </button>
  `;
}

function sourceStrip() {
  return `
    <div class="source-strip">
      ${Object.entries(systemSources).map(([key, source]) => `
        <span class="source-pill">
          <span class="dot"></span>
          ${source.name}
        </span>
      `).join("")}
    </div>
  `;
}

function renderCurrentView() {
  if (state.view === "tasks") return tasksView();
  if (state.view === "org") return orgView();
  if (state.view === "recruiting") return recruitingView();
  if (state.view === "permission") return permissionView();
  return homeView();
}

function homeView() {
  const user = state.user;
  const quickItems = homeQuickItems(user);
  const recentItems = [...commonEntries.slice(0, 3), ...roleSpecificEntries(user).slice(0, 1)];
  return `
    <div class="reference-home">
      <section class="welcome-zone">
        <h1>您好，欢迎使用 AI 工作台 <span>👋</span></h1>
        <p>用统一工作台承接企微能力、岗位入口和组织权限，让每一次工作都有记录、有流转、有结果。</p>
        <label class="home-search">
          ${uiIcon("search")}
          <input aria-label="搜索应用" placeholder="搜索应用、功能或事项..." />
          <kbd>⌘K</kbd>
        </label>
      </section>

      <section class="quick-panel">
        <h2>快速访问</h2>
        <div class="feature-grid">
          ${quickItems.map(featureCard).join("")}
        </div>
      </section>

      <section class="digital-skill-panel">
        <div class="reference-section-head">
          <div>
            <h2>数字员工</h2>
            <p>真实员工不叫助理；只有数字员工以“助理 / 教练”命名，并嵌入具体业务场景。</p>
          </div>
          <span class="tag">一期可演示</span>
        </div>
        <div class="digital-skill-grid">
          ${digitalSkills.map(digitalSkillCard).join("")}
        </div>
      </section>

      <section class="ai-banner">
        <div>
          <h2>统一工作台，连接组织与权限</h2>
          <p>入口像企微一样简单，后台按组织架构、岗位角色和审批链路决定每个人能看什么、办什么。</p>
          <button class="primary-btn" data-view="org">查看组织架构</button>
        </div>
        <div class="banner-device" aria-hidden="true">
          <span></span>
          <i></i>
          <b>AI</b>
        </div>
      </section>

      <section class="recent-panel">
        <div class="reference-section-head">
          <h2>最近使用</h2>
          <button class="chip-btn" data-view="tasks">查看全部</button>
        </div>
        <div class="recent-grid">
          ${recentItems.map(recentCard).join("")}
        </div>
      </section>
    </div>
  `;
}

function homeQuickItems(user) {
  const roleItem = roleSpecificEntries(user)[0];
  return [
    { kind: "entry", id: "approval-center", title: "审批中心", text: "请假、报销、外勤、出差统一入口", icon: "approval", tone: "blue" },
    { kind: "view", id: "tasks", title: "事项中心", text: "跨系统待办与办理结果沉淀", icon: "todo", tone: "mint" },
    { kind: "view", id: "org", title: "组织架构", text: "父子层级、人员画像与权限联动", icon: "org", tone: "violet" },
    { kind: "entry", id: "meeting-room", title: "会议室", text: "会议室预订、占用与行政协同", icon: "meeting", tone: "orange" },
    { kind: "entry", id: "permission", title: "权限申请", text: "岗位变更后自动建议权限", icon: "key", tone: "blue" },
    { kind: "entry", id: "contract-approval", title: "合同审批", text: "AI 先读合同并写入风险备注", icon: "contract", tone: "violet" },
    { kind: "view", id: "recruiting", title: "招聘体系", text: "岗位画像、胜任力模型与流程协同", icon: "recruiting", tone: "mint" },
    roleItem
      ? { kind: "entry", id: roleItem.id, title: roleItem.name, text: roleItem.scope, icon: entryIconName(roleItem), tone: "orange" }
      : { kind: "entry", id: "todo", title: "我的待办", text: "当前用户相关事项", icon: "todo", tone: "blue" }
  ];
}

function featureCard(item) {
  const action = item.kind === "view" ? `data-view="${escapeHTML(item.id)}"` : `data-entry="${escapeHTML(item.id)}"`;
  return `
    <button class="feature-card" ${action}>
      <span class="feature-icon ${escapeHTML(item.tone)}">${uiIcon(item.icon)}</span>
      <strong>${escapeHTML(item.title)}</strong>
      <p>${escapeHTML(item.text)}</p>
      <em>${uiIcon("arrow-right")}</em>
    </button>
  `;
}

function recentCard(item) {
  const source = systemSources[item.source] || systemSources.ai_workbench;
  return `
    <button class="recent-card" data-entry="${escapeHTML(item.id)}">
      <span class="recent-icon">${uiIcon(entryIconName(item))}</span>
      <div>
        <strong>${escapeHTML(item.name)}</strong>
        <p>${escapeHTML(source.name)} · ${escapeHTML(item.scope)}</p>
      </div>
    </button>
  `;
}

function digitalSkillById(id) {
  return digitalSkills.find((item) => item.id === id);
}

function digitalSkillCard(item) {
  return `
    <button class="digital-skill-card" data-skill="${escapeHTML(item.id)}">
      <span class="feature-icon ${escapeHTML(item.tone)}">${uiIcon(item.icon)}</span>
      <div>
        <strong>${escapeHTML(item.name)}</strong>
        <p>${escapeHTML(item.scene)}</p>
      </div>
      <em>${uiIcon("arrow-right")}</em>
    </button>
  `;
}

function panelHead(title, note) {
  return `
    <div class="panel-head">
      <div>
        <div class="panel-title">${escapeHTML(title)}</div>
        <p class="panel-note">${escapeHTML(note)}</p>
      </div>
    </div>
  `;
}

function moduleCard(item, isCommon) {
  const source = systemSources[item.source] || systemSources.ai_workbench;
  return `
    <button class="module-card ${isCommon ? "common" : ""}" data-entry="${item.id}" data-ui-icon="${entryIconName(item)}">
      <div class="module-top">
        <span class="module-icon" ${sourceStyle(item.source)}>${uiIcon(entryIconName(item))}</span>
        <div>
          <div class="module-name">${escapeHTML(item.name)}</div>
          <div class="module-source">${escapeHTML(source.name)}</div>
        </div>
      </div>
      <div class="module-scope">${escapeHTML(item.scope)}</div>
    </button>
  `;
}

function dockButton(item) {
  return `
    <button class="dock-item" data-entry="${item.id}" aria-label="${escapeHTML(item.name)}">
      <span class="dock-icon">${uiIcon(entryIconName(item))}</span>
      <span>${escapeHTML(item.name)}</span>
    </button>
  `;
}

function allAvailableEntries() {
  return [
    ...commonEntries,
    ...approvalEntries,
    ...Object.values(roleEntries).flat()
  ];
}

function findEntryById(id) {
  return allAvailableEntries().find((item) => item.id === id);
}

function openApprovalModal() {
  state.modal = { type: "approval" };
  addAudit(`${state.user.name} 打开审批中心，查看请假、报销、外勤、出差等二级审批。`);
  render();
}

function openEntryModal(entryId) {
  const item = findEntryById(entryId);
  if (!item) return;
  state.modal = { type: "entry", entryId };
  addAudit(`${state.user.name} 打开「${item.name}」办理页。`);
  render();
}

function openDigitalSkillModal(skillId) {
  const item = digitalSkillById(skillId);
  if (!item) return;
  state.modal = { type: "skill", skillId };
  addAudit(`${state.user.name} 打开数字员工「${item.name}」Skill 演示。`);
  render();
}

function openDepartmentModal(deptCode) {
  const dept = departmentByCode(deptCode);
  state.selectedDept = dept.code;
  state.selectedPerson = dept.members[0];
  state.modal = { type: "department", deptCode: dept.code };
  const accessText = canAccessDepartment(state.user, dept) ? "可进入部门文档" : "仅可查看组织信息";
  addAudit(`${state.user.name} 查看「${dept.name}」组织节点，权限结果：${accessText}。`);
  render();
}

function openProfileModal(personName) {
  const profileItem = employeeProfiles[personName];
  if (!profileItem) return;
  state.selectedPerson = personName;
  state.selectedDept = profileItem.departmentCode;
  state.modal = { type: "profile", personName };
  const detailText = canViewProfileDetail(state.user, profileItem) ? "可查看交接画像" : "仅查看基础画像";
  addAudit(`${state.user.name} 查看「${personName}」人员画像，权限结果：${detailText}。`);
  render();
}

function closeModal() {
  state.modal = null;
  render();
}

function renderModal() {
  if (!state.modal) return "";
  if (state.modal.type === "approval") return renderApprovalModal();
  if (state.modal.type === "entry") return renderEntryModal(findEntryById(state.modal.entryId));
  if (state.modal.type === "skill") return renderDigitalSkillModal(digitalSkillById(state.modal.skillId));
  if (state.modal.type === "department") return renderDepartmentModal(departmentByCode(state.modal.deptCode));
  if (state.modal.type === "profile") return renderProfileModal(employeeProfiles[state.modal.personName]);
  return "";
}

function modalShell(title, note, body, footer = "") {
  return `
    <div class="modal-backdrop" data-modal-backdrop>
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}">
        <div class="modal-head">
          <div>
            <h2>${escapeHTML(title)}</h2>
            <p>${escapeHTML(note)}</p>
          </div>
          <button class="modal-close" data-modal-close aria-label="关闭">&times;</button>
        </div>
        <div class="modal-body">
          ${body}
        </div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
      </section>
    </div>
  `;
}

function renderApprovalModal() {
  return modalShell(
    "审批中心",
    "通用审批只保留一个入口，进入后再选择请假、报销、外勤、出差、补卡等具体页面。",
    `
      <div class="module-grid modal-grid">
        ${approvalEntries.map((item) => moduleCard(item, true)).join("")}
      </div>
      <div class="access-note">正式版本可以对接企微审批模板；Demo 先用弹窗展示二级页面，并把提交动作沉淀为事项卡。</div>
    `
  );
}

function renderEntryModal(item) {
  if (!item) return "";
  if (item.taskType === "contract") return renderContractApprovalModal(item);
  const source = systemSources[item.source] || systemSources.ai_workbench;
  const embeddedSkill = embeddedSkillForEntry(item);
  return modalShell(
    item.name,
    `${source.name} · ${item.scope}`,
    `
      <div class="entry-summary">
        ${permissionFact("来源系统", source.name)}
        ${permissionFact("数据范围", item.scope)}
        ${permissionFact("处理负责人", ownerFor(item.taskType))}
      </div>
      <div class="fake-form">
        ${entryFields(item).map((field) => `
          <div class="fake-field">
            <span>${escapeHTML(field[0])}</span>
            <strong>${escapeHTML(field[1])}</strong>
          </div>
        `).join("")}
      </div>
      ${embeddedSkill ? embeddedSkillStrip(embeddedSkill) : ""}
      <div class="access-note">${escapeHTML(state.api.online ? "提交后会调用后端接口，写入审批/事项数据。" : "后端未连接：此处只展示表单与字段，不能提交真实流程。")}</div>
    `,
    `
      <button class="ghost-btn" data-modal-close>取消</button>
      <button class="primary-btn" data-submit-entry="${escapeHTML(item.id)}">提交到后端流程</button>
    `
  );
}

function renderDigitalSkillModal(item) {
  if (!item) return "";
  return modalShell(
    item.name,
    `${item.scene} · 数字员工 Skill 演示`,
    `
      <div class="skill-demo-layout">
        <section class="skill-brief">
          <span class="feature-icon ${escapeHTML(item.tone)}">${uiIcon(item.icon)}</span>
          <div>
            <h3>${escapeHTML(item.name)}</h3>
            <p>${escapeHTML(item.summary)}</p>
          </div>
        </section>

        <section class="skill-block">
          <span>示例输入</span>
          <strong>${escapeHTML(item.sampleInput)}</strong>
        </section>

        <section class="skill-block">
          <span>后端 Skill 输出</span>
          <div class="skill-output-list">
            ${item.output.map((line) => `<div>${escapeHTML(line)}</div>`).join("")}
          </div>
        </section>

        <section class="skill-workflow">
          ${permissionFact("技能工作流", item.workflow)}
          ${permissionFact("人工确认", item.humanGate)}
          ${permissionFact("写回位置", item.writeBack)}
          ${permissionFact("接口状态", state.api.online ? "后端已连接，可写入流程" : "后端未连接，当前只展示 Skill 设计")}
        </section>
      </div>
    `,
    `
      <button class="ghost-btn" data-modal-close>取消</button>
      <button class="primary-btn" data-run-skill="${escapeHTML(item.id)}">运行 Skill 流程</button>
    `
  );
}

function embeddedSkillForEntry(item) {
  const map = {
    expense: "expense-assistant",
    field: "travel-field-assistant",
    travel: "travel-field-assistant",
    meeting: "meeting-schedule-assistant",
    schedule: "meeting-schedule-assistant",
    todo: "weekly-report-assistant",
    contract: "contract-approval-assistant"
  };
  return digitalSkillById(map[item.taskType]);
}

function embeddedSkillStrip(item) {
  return `
    <div class="embedded-skill">
      <span class="feature-icon ${escapeHTML(item.tone)}">${uiIcon(item.icon)}</span>
      <div>
        <strong>${escapeHTML(item.name)}</strong>
        <p>${escapeHTML(item.summary)}</p>
      </div>
      <button class="chip-btn" data-skill="${escapeHTML(item.id)}">查看 Skill</button>
    </div>
  `;
}

function renderContractApprovalModal(item) {
  const source = systemSources[item.source] || systemSources.ai_workbench;
  return modalShell(
    item.name,
    "员工提交后先进入 AI 预审；老板不会第一时间看到，必须带教/主管、法务、总助都通过后才进入老板终审。",
    `
      <div class="contract-layout">
        <div class="contract-upload">
          <span class="module-icon">${uiIcon("contract")}</span>
          <div>
            <div class="task-title">上传合同文件</div>
            <p class="panel-note">支持 PDF、Word、图片扫描件。正式版上传后调用合同解析与风险识别接口。</p>
          </div>
          <button class="ghost-btn" type="button">选择文件</button>
        </div>

        ${embeddedSkillStrip(digitalSkillById("contract-approval-assistant"))}

        <div class="ai-risk-note">
          <div class="risk-head">
            <span class="tag">AI 风险备注</span>
            <strong>已读完整合同，生成审批备注</strong>
          </div>
          <div class="risk-list">
            <div class="risk-item low">
              <span>低风险</span>
              <strong>合同主体、签署信息、基础金额字段完整。</strong>
            </div>
            <div class="risk-item medium">
              <span>中风险</span>
              <strong>付款节点与验收标准描述偏宽，建议带教/主管确认交付口径。</strong>
            </div>
            <div class="risk-item high">
              <span>高风险</span>
              <strong>违约责任上限未明确，建议法务初审前补充责任边界。</strong>
            </div>
          </div>
          <div class="approval-remark">
            <span>写入备注</span>
            <strong>AI 风险备注随审批链逐步流转；总助只能在法务审核通过后收到复核待办，老板仅在总助复核通过后收到终审待办。</strong>
          </div>
        </div>

        <div class="approval-chain">
          ${contractApprovalStages.map((step, index) => `
            <div class="chain-step">
              <span>${String(index + 1).padStart(2, "0")}</span>
              <strong>${escapeHTML(step.label)}</strong>
            </div>
          `).join("")}
        </div>
        <div class="access-note">后端规则：合同状态为 submitted / ai_review / mentor_review / legal_review / assistant_review 时，老板待办不可见；只有 boss_review 或 archived 才进入老板视角。</div>
      </div>
    `,
    `
      <button class="ghost-btn" data-modal-close>取消</button>
      <button class="primary-btn" data-submit-entry="${escapeHTML(item.id)}">提交合同审批</button>
    `
  );
}

function entryFields(item) {
  const fields = {
    expense: [["费用类型", "交通/项目/行政费用"], ["关联项目", "校园招聘项目"], ["附件", "发票 OCR 识别后自动命名"], ["审批链", "本人 -> 主管 -> 财务"]],
    contract: [["合同文件", "上传 PDF / Word / 图片扫描件"], ["AI 读取", "先读完整合同，再生成风险备注"], ["风险备注", "低/中/高风险写入审批备注，按阶段可见"], ["审批链", "员工提交 -> AI 预审 -> 带教/主管 -> 法务 -> 总助 -> 老板终审 -> 归档"]],
    leave: [["请假类型", "年假/事假/病假"], ["开始时间", "选择日期时间"], ["结束时间", "选择日期时间"], ["审批链", "本人 -> 直属主管 -> HR 汇总"]],
    field: [["外勤地点", "客户/学校/供应商地址"], ["外勤原因", "拜访、宣讲、交付支持"], ["审批链", "本人 -> 直属主管"]],
    travel: [["出差地点", "城市/客户/项目"], ["预算归属", "项目或部门费用"], ["审批链", "本人 -> 主管 -> 财务"]],
    attendance: [["补卡日期", "选择漏打卡时间"], ["补卡原因", "忘打卡/外勤/设备异常"], ["审批链", "本人 -> 直属主管"]],
    permission: [["申请系统", "根据岗位推荐常用权限"], ["权限原因", "项目、调岗或新增职责"], ["审批链", "本人 -> 主管 -> 管理员"]],
    meeting: [["会议室", "选择地点与时间段"], ["参会人", "同步日程"], ["资源", "投影/白板/访客"]],
    schedule: [["日程类型", "会议/宣讲/转正面谈"], ["参与人", "同步到相关人员"], ["材料", "PPT、纪要或附件"]],
    payment: [["付款对象", "供应商或员工"], ["付款金额", "按财务权限展示"], ["审批链", "发起人 -> 财务 -> 授权审批"]],
    approval: [["审批类型", "行政、付款、物资或通用审批"], ["表单模板", "按企微审批模板映射"], ["状态回写", "后续同步企微审批状态"]],
    todo: [["事项来源", "审批、人事、项目、财务"], ["处理动作", "完成/补充/转交"], ["结果", "写回事项中心"]]
  };
  return fields[item.taskType] || [["办理内容", item.name], ["数据范围", item.scope], ["状态", "提交后进入事项中心"]];
}

function renderDepartmentModal(dept) {
  const canOpenDocs = canAccessDepartment(state.user, dept);
  const canManage = canManageOrg(state.user);
  return modalShell(
    dept.name,
    `${dept.lead} 负责 · ${dept.members.length} 人 · ${departmentPath(dept).join(" / ")}`,
    `
      <div class="org-detail">
        <div class="detail-row">
          <span>成员</span>
          <div class="member-list">
            ${dept.members.map((name) => memberButton(name)).join("")}
          </div>
        </div>
        <div class="detail-row">
          <span>数据范围</span>
          <strong>${escapeHTML(canOpenDocs ? dept.dataScope : "仅组织公开信息")}</strong>
        </div>
        <div class="detail-row">
          <span>流程权限</span>
          <strong>${escapeHTML(canOpenDocs ? dept.workflow : "不可进入部门业务流程")}</strong>
        </div>
        <div class="doc-list">
          ${dept.docs.map((doc) => `
            <button class="doc-chip ${canOpenDocs ? "" : "locked"}" ${canOpenDocs ? "" : "disabled"}>
              ${escapeHTML(doc)}
            </button>
          `).join("")}
        </div>
        <p class="panel-note">${escapeHTML(canOpenDocs ? dept.note : "你可以看到该部门存在和人员归属，但不能打开该部门私有文档和业务数据。")}</p>
      </div>
    `,
    canManage ? `
      <button class="ghost-btn" data-org-action="permission">生成权限差异清单</button>
      <button class="primary-btn" data-org-action="transfer">模拟调岗并生成交接</button>
    ` : ""
  );
}

function renderProfileModal(profileItem) {
  if (!profileItem) return "";
  const canViewFullProfile = canViewProfileDetail(state.user, profileItem);
  return modalShell(
    "人员画像",
    `${profileItem.name} · ${profileItem.department} · ${profileItem.position}`,
    `
      <div class="profile-card">
        <div class="profile-head">
          <div class="avatar small">${escapeHTML(profileItem.name.slice(0, 1))}</div>
          <div>
            <h3>${escapeHTML(profileItem.name)}</h3>
            <p>${escapeHTML(profileItem.department)} · ${escapeHTML(profileItem.manager)} 主管</p>
          </div>
          <span class="org-access ${canViewFullProfile ? "allowed" : ""}">${canViewFullProfile ? "交接可用" : "基础信息"}</span>
        </div>
        <div class="tag-row">
          ${profileItem.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
        </div>
        <div class="permission-stack">
          ${permissionFact("当前工作", profileItem.currentWork)}
          ${permissionFact("画像摘要", profileItem.summary)}
          ${permissionFact("月度量化", canViewFullProfile ? `${profileItem.score} · ${profileItem.monthly}` : "无权查看量化明细")}
          ${permissionFact("交接参考", canViewFullProfile ? profileItem.handover : "仅主管、HR、老板、总助或本人可查看")}
          ${permissionFact("注意事项", canViewFullProfile ? profileItem.risk : "敏感信息已隐藏")}
        </div>
      </div>
    `,
    `<button class="ghost-btn" data-open-dept="${escapeHTML(profileItem.departmentCode)}">返回部门</button>`
  );
}

function tasksView() {
  return `
    <section class="panel">
      ${panelHead("事项中心", "所有入口的动作都沉淀到这里，先统一状态，再逐步对接原系统。")}
      <div class="task-list">
        ${visibleTasks(state.user).map(renderTaskRow).join("")}
      </div>
    </section>
  `;
}

function orgView() {
  const user = state.user;
  const canManage = canManageOrg(user);
  const userDept = departmentByCode(user.departmentCode);
  return `
    <div class="org-page">
      <section class="panel org-main-panel">
        ${panelHead("组织架构", "先展开父级，再进入子级详情；权限、文档和数据范围由部门、岗位、角色和项目授权共同决定。")}
        <div class="org-tree">
          ${renderOrgTree()}
        </div>
      </section>
      <div class="org-support-grid">
        <section class="panel compact-panel">
          ${panelHead("组织变更交接", "组织变更不是只改一个部门字段，而是同步处理权限回收、权限开通和资料交接。")}
          <div class="handover-flow">
            ${["调整组织", "计算权限差异", "回收旧权限", "开通新权限", "资料/项目交接", "主管确认"].map((step, index) => `
              <div class="flow-step">
                <span>${index + 1}</span>
                <strong>${escapeHTML(step)}</strong>
              </div>
            `).join("")}
          </div>
        </section>
        <section class="panel compact-panel">
          ${panelHead("当前账号权限", `${user.name} · ${user.department} · ${user.roleName}`)}
          <div class="permission-stack">
            ${permissionFact("组织归属", user.department)}
            ${permissionFact("组织路径", departmentPath(userDept).join(" / "))}
            ${permissionFact("默认文档", userDept.docs.join("、"))}
            ${permissionFact("数据范围", user.scope)}
            ${permissionFact("调整组织", canManage ? "可调整组织架构并触发权限交接" : "不可调整，只能查看组织关系")}
          </div>
          ${canManage ? `
            <div class="org-actions">
              <button class="primary-btn" data-org-action="transfer">模拟调岗并生成交接</button>
              <button class="ghost-btn" data-org-action="permission">生成权限差异清单</button>
            </div>
          ` : `
            <div class="access-note">普通员工、主管、HR、财务默认不能直接调整组织架构。需要变更时由老板或总助发起。</div>
          `}
        </section>
      </div>
    </div>
  `;
}

function selectedDepartment() {
  const defaultCode = state.selectedDept || state.user.departmentCode || "product";
  return departmentByCode(defaultCode);
}

function selectedEmployeeProfile(dept) {
  const candidate = employeeProfiles[state.selectedPerson];
  if (candidate && candidate.departmentCode === dept.code) return candidate;
  const firstMember = dept.members[0];
  state.selectedPerson = firstMember;
  return employeeProfiles[firstMember] || Object.values(employeeProfiles)[0];
}

function departmentByCode(code) {
  return orgDepartments.find((dept) => dept.code === code) || orgDepartments[0];
}

function orgChildren(parentCode) {
  return orgDepartments.filter((dept) => (dept.parentCode || null) === (parentCode || null));
}

function renderOrgTree(parentCode = null, depth = 0) {
  return orgChildren(parentCode).map((dept) => `
    ${orgDepartmentCard(dept, depth)}
    ${orgChildren(dept.code).length && state.expandedDepts.includes(dept.code) ? `<div class="org-children">${renderOrgTree(dept.code, depth + 1)}</div>` : ""}
  `).join("");
}

function departmentPath(dept) {
  const path = [];
  let current = dept;
  while (current) {
    path.unshift(current.name);
    current = current.parentCode ? departmentByCode(current.parentCode) : null;
  }
  return path;
}

function departmentPathCodes(code) {
  const path = [];
  let current = departmentByCode(code);
  while (current) {
    path.unshift(current.code);
    current = current.parentCode ? departmentByCode(current.parentCode) : null;
  }
  return Array.from(new Set(["bfe", ...path]));
}

function toggleDepartment(code) {
  if (state.expandedDepts.includes(code)) {
    state.expandedDepts = state.expandedDepts.filter((item) => item !== code);
    return false;
  }
  state.expandedDepts = Array.from(new Set([...state.expandedDepts, ...departmentPathCodes(code), code]));
  return true;
}

function isDepartmentInSubtree(targetCode, ancestorCode) {
  if (targetCode === ancestorCode) return true;
  let current = departmentByCode(targetCode);
  while (current && current.parentCode) {
    if (current.parentCode === ancestorCode) return true;
    current = departmentByCode(current.parentCode);
  }
  return false;
}

function canManageOrg(user) {
  return ["boss", "assistant"].includes(user.role);
}

function canAccessDepartment(user, dept) {
  if (canManageOrg(user)) return true;
  if (["bfe"].includes(dept.code)) return true;
  if (user.departmentCode === dept.code) return true;
  if (isDepartmentInSubtree(dept.code, user.departmentCode)) return true;
  if (user.role === "hr" && dept.code === "hr") return true;
  if (user.role === "finance" && dept.code === "finance") return true;
  if (user.role === "legal" && dept.code === "legal") return true;
  if (user.role === "manager" && dept.code === "product") return true;
  return false;
}

function canViewProfileDetail(user, profileItem) {
  if (!profileItem) return false;
  if (user.name === profileItem.name) return true;
  if (canManageOrg(user)) return true;
  if (user.role === "hr") return true;
  if (user.role === "legal" && user.departmentCode === profileItem.departmentCode) return true;
  if (user.role === "manager" && user.departmentCode === profileItem.departmentCode) return true;
  return false;
}

function orgDepartmentCard(dept, depth = 0) {
  const active = selectedDepartment().code === dept.code;
  const hasAccess = canAccessDepartment(state.user, dept);
  const childCount = orgChildren(dept.code).length;
  const expanded = state.expandedDepts.includes(dept.code);
  return `
    <button class="org-node ${active ? "active" : ""} ${childCount ? "expandable" : "leaf"}" data-dept="${dept.code}">
      <div class="org-node-main">
        <span class="org-chevron ${expanded ? "expanded" : ""}">${childCount ? ">" : "-"}</span>
        <span class="org-dot ${hasAccess ? "open" : "closed"}"></span>
        <div>
          <strong>${escapeHTML(dept.name)}</strong>
          <p>${escapeHTML(dept.lead)} · ${dept.members.length} 人${childCount ? ` · ${childCount} 个子部门` : ""}</p>
        </div>
      </div>
      <span class="org-access ${hasAccess ? "allowed" : ""}">${childCount ? (expanded ? "收起" : "展开") : (hasAccess ? "查看" : "基础")}</span>
    </button>
  `;
}

function memberButton(name) {
  const active = selectedEmployeeProfile(selectedDepartment()).name === name;
  const profileItem = employeeProfiles[name];
  const canView = profileItem ? canViewProfileDetail(state.user, profileItem) : false;
  return `
    <button class="member-chip ${active ? "active" : ""}" data-person="${escapeHTML(name)}">
      <span>${escapeHTML(name)}</span>
      <small>${canView ? "画像" : "基础"}</small>
    </button>
  `;
}

function permissionFact(label, value) {
  return `
    <div class="permission-fact">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>
  `;
}

function renderTaskRow(item) {
  return `
    <div class="task-row">
      <div class="task-main">
        <div>
          <div class="task-title">${escapeHTML(item.title)}</div>
          <div class="task-meta">
            <span>${escapeHTML(item.id)}</span>
            <span>${escapeHTML(item.sourceName)}</span>
            <span>负责人：${escapeHTML(item.owner)}</span>
            ${item.approvalStage ? `<span>阶段：${escapeHTML(contractStageLabel(item.approvalStage))}</span>` : ""}
            <span>截止：${escapeHTML(item.due)}</span>
            ${item.result ? `<span>结论：${escapeHTML(item.result)}</span>` : ""}
          </div>
        </div>
        <span class="status ${item.status}">${statusName(item.status)}</span>
      </div>
      <div class="task-foot">
        ${item.type === "work_deviation" ? `
          <button class="small-btn" data-deviation="${item.id}" data-result="偏离计划">偏离计划</button>
          <button class="small-btn" data-deviation="${item.id}" data-result="未偏离计划">未偏离</button>
          <button class="small-btn" data-deviation="${item.id}" data-result="需调整方向">需调整方向</button>
        ` : `
          <button class="small-btn" data-complete="${item.id}">标记完成</button>
          <button class="small-btn" data-need="${item.id}">需补充</button>
        `}
      </div>
    </div>
  `;
}

function statusName(status) {
  return {
    pending: "待处理",
    processing: "处理中",
    completed: "已完成",
    need_info: "需补充",
    cancelled: "已取消"
  }[status] || status;
}

function contractStageLabel(stage) {
  const matched = contractApprovalStages.find((item) => item.key === stage);
  return matched ? matched.label : stage;
}

function permissionRows() {
  return [
    { name: "报销", roles: "全员入口", scope: "员工看本人，主管看团队/项目，财务看明细，老板看汇总异常。" },
    { name: "请假", roles: "全员入口", scope: "员工看本人，主管看团队，HR 看全员假勤汇总。" },
    { name: "销售文档", roles: "销售组/项目授权/老板/总助", scope: "销售组默认可见；产品组员工不可见，除非被加入对应项目授权。" },
    { name: "产品文档", roles: "产品组/项目授权/老板/总助", scope: "产品及运营部默认可见；销售组员工不可见，除非被加入对应项目授权。" },
    { name: "组织架构", roles: "全员可见", scope: "所有员工都能看组织树和人员归属，但不能越权进入部门私有文档和业务数据。" },
    { name: "组织调整", roles: "老板/总助", scope: "调整部门、岗位、直属主管后，自动生成旧权限回收、新权限开通和资料交接事项。" },
    { name: "转正", roles: "HR/主管/老板", scope: "主管看本团队，HR 看全员，老板看关键节点和异常。" },
    { name: "工作量化", roles: "本人/主管", scope: "员工看自己的月度总结；低于阈值时提醒直属主管确认是否偏离计划或方向。" },
    { name: "招聘体系", roles: "老板/HR/相关主管", scope: "老板看全局，HR 维护，主管看参与岗位。" },
    { name: "付款", roles: "财务/老板", scope: "财务看明细，老板看汇总和异常，不对普通员工开放。" },
    { name: "法务资料", roles: "法务/老板/总助", scope: "法务看合同模板、风险意见和归档合同；普通员工只看自己发起的合同流程。" }
  ];
}

function recruitingView() {
  if (!["boss", "hr", "manager"].includes(state.user.role)) {
    return restrictedView("当前角色无权访问招聘体系看板。");
  }
  return `
    <div class="left-column">
      ${recruitingSummary()}
      <section class="panel">
        ${panelHead("候选人漏斗", "从智能打招呼到入职，展示招聘流程是否被体系化。")}
        <div class="funnel">
          ${recruitingFunnel.map(([name, value]) => funnelRow(name, value)).join("")}
        </div>
      </section>
      <section class="panel">
        ${panelHead("招聘资产", "岗位分析、人才画像、胜任力模型、DISC 测评和简历摘要。")}
        <div class="module-grid">
          ${[
            entry("job-analysis", "岗位分析卡", "招聘工具", "recruiting", "GW", "recruiting", "CPD/财务/法务"),
            entry("portrait", "人才画像卡", "招聘工具", "recruiting", "RC", "recruiting", "经验/能力/价值观"),
            entry("competency", "胜任力模型", "招聘工具", "recruiting", "SL", "recruiting", "能力项/等级标准"),
            entry("disc", "DISC 测评", "招聘工具", "recruiting", "DI", "recruiting", "测评结果记录"),
            entry("resume-ai", "简历提取专家", "招聘工具", "recruiting", "JL", "recruiting", "扣子智能体模拟"),
            entry("boss-rpa", "BOSS 智能打招呼", "招聘工具", "recruiting", "RP", "recruiting", "八爪鱼 RPA 模拟")
          ].map((item) => moduleCard(item, false)).join("")}
        </div>
      </section>
    </div>
  `;
}

function recruitingSummary() {
  return `
    <section class="panel">
      ${panelHead("招聘体系化搭建", "老板重点看：标准是否搭好，流程是否自动化，结果是否能回流。")}
      <div class="metrics-row">
        ${metric("岗位画像", "68%", "12/18 岗位完成")}
        ${metric("胜任力模型", "54%", "关键岗位优先")}
        ${metric("DISC 接入", "31", "候选人已测评")}
        ${metric("质量回流", "P1", "转正/工作量化待接入")}
      </div>
    </section>
  `;
}

function metric(label, value, note) {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHTML(label)}</div>
      <div class="metric-number">${escapeHTML(value)}</div>
      <div class="data-change">${escapeHTML(note)}</div>
    </div>
  `;
}

function funnelRow(name, value) {
  const max = recruitingFunnel[0][1];
  const width = Math.max(8, Math.round((value / max) * 100));
  return `
    <div class="funnel-row">
      <span>${escapeHTML(name)}</span>
      <div class="bar-track"><div class="bar" style="width:${width}%"></div></div>
      <strong>${value}</strong>
    </div>
  `;
}

function permissionView() {
  return `
    <section class="panel">
      ${panelHead("权限管理", "不同岗位和角色拥有不同的数据范围与操作权限。")}
      <div class="task-list">
        ${permissionRows().map((row) => `
          <div class="task-row">
            <div class="task-main">
              <div>
                <div class="task-title">${escapeHTML(row.name)}</div>
                <div class="task-meta">${escapeHTML(row.scope)}</div>
              </div>
              <span class="tag">${escapeHTML(row.roles)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function logsView() {
  const changeCount = state.audit.filter((item) => ["组织变更", "权限", "事项变更", "人员画像"].includes(item.category)).length;
  const accessCount = state.audit.filter((item) => item.category === "访问").length;
  return `
    <section class="panel">
      ${panelHead("日志审计", "所有关键改动都要记录：谁改的、改了什么、变更前后、影响范围和处理结果。")}
      <div class="metrics-row audit-metrics">
        ${metric("全部日志", String(state.audit.length), "访问与变更")}
        ${metric("变更日志", String(changeCount), "组织/权限/事项/画像")}
        ${metric("访问日志", String(accessCount), "登录/查看/拦截")}
        ${metric("可追溯", "100%", "Demo 关键动作留痕")}
      </div>
    </section>
    <section class="panel" style="margin-top:14px">
      ${panelHead("日志明细", "Demo 用本地数据模拟；正式版本需写入后端审计表，禁止前端篡改。")}
      <div class="audit-list">
        ${state.audit.map(renderAuditLine).join("")}
      </div>
    </section>
  `;
}

function renderAuditLine(item) {
  const log = normalizeAudit(item);
  return `
    <div class="audit-line rich">
      <div class="audit-main">
        <span class="tag">${escapeHTML(log.category)}</span>
        <div>
          <div class="task-title">${escapeHTML(log.action)}</div>
          <div class="task-meta">
            <span>${escapeHTML(log.time)}</span>
            <span>操作人：${escapeHTML(log.actor)}</span>
            <span>对象：${escapeHTML(log.object)}</span>
          </div>
        </div>
        <span class="status completed">${escapeHTML(log.status)}</span>
      </div>
      <div class="audit-diff">
        <div><span>变更前</span><strong>${escapeHTML(log.before)}</strong></div>
        <div><span>变更后</span><strong>${escapeHTML(log.after)}</strong></div>
        <div><span>影响范围</span><strong>${escapeHTML(log.impact)}</strong></div>
      </div>
    </div>
  `;
}

function normalizeAudit(item) {
  if (typeof item === "string") {
    return {
      time: formatTime(new Date()),
      category: "日志",
      actor: state.user ? state.user.name : "系统",
      action: item,
      object: "-",
      before: "-",
      after: item,
      impact: "历史文字日志",
      status: "成功"
    };
  }
  return item;
}

function restrictedView(message) {
  return `
    <section class="panel">
      ${panelHead("无权限", message)}
      <button class="primary-btn" data-view="home">返回首页</button>
    </section>
  `;
}

function bindViewEvents() {
  document.querySelectorAll("[data-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.entry;
      const item = findEntryById(id);
      if (!item) return;
      if (["org-manage", "org-health"].includes(item.id)) {
        state.view = "org";
        state.selectedDept = state.user.departmentCode;
        state.expandedDepts = departmentPathCodes(state.user.departmentCode);
        addAudit(`${state.user.name} 进入组织架构页，查看组织与权限关系。`);
        render();
        return;
      }
      if (item.id === "approval-center") {
        openApprovalModal();
        return;
      }
      if (["recruiting-system", "recruiting-flow"].includes(item.id)) {
        state.view = "recruiting";
        addAudit(`${state.user.name} 进入招聘体系化看板。`);
        render();
        return;
      }
      openEntryModal(item.id);
    });
  });

  document.querySelectorAll("[data-submit-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = findEntryById(button.dataset.submitEntry);
      if (item) submitEntryWorkflow(item);
    });
  });

  document.querySelectorAll("[data-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      openDigitalSkillModal(button.dataset.skill);
    });
  });

  document.querySelectorAll("[data-run-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      runSkillWorkflow(button.dataset.runSkill);
    });
  });

  document.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  document.querySelectorAll("[data-modal-backdrop]").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
  });

  document.querySelectorAll("[data-open-dept]").forEach((button) => {
    button.addEventListener("click", () => openDepartmentModal(button.dataset.openDept));
  });

  document.querySelectorAll("[data-dept]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDept = button.dataset.dept;
      const dept = departmentByCode(state.selectedDept);
      const childCount = orgChildren(dept.code).length;
      if (childCount) {
        const expanded = toggleDepartment(dept.code);
        addAudit(`${state.user.name} ${expanded ? "展开" : "收起"}「${dept.name}」组织子级。`);
        render();
        return;
      }
      openDepartmentModal(dept.code);
    });
  });

  document.querySelectorAll("[data-person]").forEach((button) => {
    button.addEventListener("click", () => {
      openProfileModal(button.dataset.person);
    });
  });

  document.querySelectorAll("[data-org-action]").forEach((button) => {
    button.addEventListener("click", () => handleOrgAction(button.dataset.orgAction));
  });

  document.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", () => updateTask(button.dataset.complete, "completed"));
  });

  document.querySelectorAll("[data-need]").forEach((button) => {
    button.addEventListener("click", () => updateTask(button.dataset.need, "need_info"));
  });

  document.querySelectorAll("[data-deviation]").forEach((button) => {
    button.addEventListener("click", () => confirmDeviation(button.dataset.deviation, button.dataset.result));
  });

  document.querySelectorAll("[data-suggest]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("aiInput");
      input.value = button.dataset.suggest;
      state.aiText = input.value;
    });
  });

  const aiButton = document.getElementById("aiRunBtn");
  if (aiButton) aiButton.addEventListener("click", handleAI);
}

function bindPointerGlow() {
  const glowTargets = document.querySelectorAll([
    ".topbar",
    ".feature-card",
    ".recent-card",
    ".ai-banner",
    ".home-hero",
    ".dock-item",
    ".hero-action",
    ".module-card",
    ".panel",
    ".task-row",
    ".metric-card",
    ".org-node",
    ".flow-step",
    ".permission-fact",
    ".fake-field",
    ".audit-line.rich"
  ].join(","));

  glowTargets.forEach((target) => {
    target.addEventListener("pointermove", (event) => {
      const rect = target.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      target.style.setProperty("--mx", `${x.toFixed(1)}%`);
      target.style.setProperty("--my", `${y.toFixed(1)}%`);
    });
  });
}

async function createTaskFromEntry(item) {
  return submitEntryWorkflow(item);
}

function requireBackend(actionName) {
  if (state.api.online) return true;
  addAudit(`${actionName}失败：后端未连接。`, {
    category: "接口",
    object: "Backend API",
    before: "未连接",
    after: "未提交",
    impact: "静态页面只展示流程，不能写入真实审批或事项"
  });
  alert("后端未连接，不能提交真实流程。请在本地运行 node server.js 后，再从 http://localhost:3000 打开 demo。");
  return false;
}

function upsertBackendTask(newTask) {
  if (!newTask) return;
  tasks = [newTask, ...tasks.filter((item) => item.id !== newTask.id)];
}

async function submitEntryWorkflow(item) {
  if (item.id === "approval-center") {
    openApprovalModal();
    return;
  }
  if (!requireBackend(`提交${item.name}`)) return;
  const source = systemSources[item.source] || systemSources.ai_workbench;
  try {
    const payload = item.taskType === "contract"
      ? await apiRequest("/api/approvals/contracts", {
          method: "POST",
          body: JSON.stringify({
            title: "客户合同审批",
            fileName: "客户合同_demo.pdf",
            project: "销售合同",
            amount: "待识别"
          })
        })
      : await apiRequest("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            entryId: item.id,
            title: `${state.user.name} 发起：${item.name}`,
            type: item.taskType,
            source: item.source,
            sourceName: source.name
          })
        });
    upsertBackendTask(payload.task);
    addAudit("提交后端流程", {
      category: "接口",
      object: payload.task ? payload.task.id : item.id,
      before: "前端表单",
      after: item.taskType === "contract" ? "写入合同审批：ai_review" : "写入事项中心",
      impact: item.taskType === "contract"
        ? "老板不可见；AI 预审完成后才流转到带教/主管"
        : `来源系统：${source.name}`
    });
    state.modal = null;
    state.view = "tasks";
    render();
  } catch (error) {
    state.api.online = false;
    state.api.message = `后端提交失败：${error.message}`;
    addAudit("提交后端流程失败", {
      category: "接口",
      object: item.id,
      before: "准备提交",
      after: error.message,
      impact: "流程未写入"
    });
    alert(`后端提交失败：${error.message}`);
    render();
  }
}

async function runSkillWorkflow(skillId) {
  const item = digitalSkillById(skillId);
  if (!item || !requireBackend(`运行${item ? item.name : "Skill"}`)) return;
  try {
    const payload = await apiRequest(`/api/skills/${encodeURIComponent(skillId)}/run`, {
      method: "POST",
      body: JSON.stringify({ input: item.sampleInput })
    });
    upsertBackendTask(payload.task);
    addAudit("运行后端 Skill", {
      category: "接口",
      object: item.name,
      before: "前端示例输入",
      after: payload.task ? `${payload.task.id} / ${statusName(payload.task.status)}` : "已返回运行结果",
      impact: skillId === "contract-approval-assistant" ? "合同进入 AI 预审，老板暂不可见" : item.writeBack
    });
    state.modal = null;
    state.view = "tasks";
    render();
  } catch (error) {
    state.api.online = false;
    state.api.message = `Skill 运行失败：${error.message}`;
    addAudit("运行后端 Skill 失败", {
      category: "接口",
      object: item.name,
      before: "准备运行",
      after: error.message,
      impact: "流程未写入"
    });
    alert(`Skill 运行失败：${error.message}`);
    render();
  }
}

function ownerFor(taskType) {
  if (["expense", "expense_review", "invoice", "payment", "cost", "project_cost"].includes(taskType)) return "财务";
  if (["org_change", "handover"].includes(taskType)) return "总助";
  if (["onboard", "probation", "transfer", "resign", "hr_file"].includes(taskType)) return "HR";
  if (["project", "todo", "schedule", "leave", "field", "travel", "attendance", "meeting", "approval"].includes(taskType)) return "主管";
  if (["contract"].includes(taskType)) return "合同审批助理";
  if (["recruiting"].includes(taskType)) return "HR";
  if (["legal", "risk"].includes(taskType)) return "法务接口人";
  return "主管";
}

function handleOrgAction(action) {
  if (!canManageOrg(state.user)) {
    addAudit(`${state.user.name} 尝试调整组织架构，被权限拦截。`);
    alert("当前账号无权调整组织架构。");
    return;
  }

  const title = action === "transfer"
    ? "组织变更：员工从销售组转入产品及运营部，生成权限交接"
    : "权限差异清单：销售文档回收，产品文档开通，主管交接确认";
  const newTask = task(
    `T-${Math.floor(2000 + Math.random() * 7000)}`,
    title,
    "org_change",
    "hr",
    "总助",
    "pending",
    "2026-07-09",
    "组织权限"
  );
  newTask.initiator = state.user.name;
  tasks = [newTask, ...tasks];
  addAudit(action === "transfer" ? "调整组织架构" : "生成权限差异清单", {
    category: "组织变更",
    object: "员工",
    before: action === "transfer" ? "销售组 / 销售文档权限 / 原主管" : "销售文档权限、产品文档权限未计算",
    after: action === "transfer" ? "产品及运营部 / 产品文档权限 / 新主管待确认" : "销售文档回收，产品文档开通，主管交接确认",
    impact: "自动生成权限回收、权限开通、资料交接和主管确认事项"
  });
  state.modal = null;
  state.view = "tasks";
  render();
}

function updateTask(taskId, status) {
  const oldTask = tasks.find((item) => item.id === taskId);
  tasks = tasks.map((item) => item.id === taskId ? { ...item, status } : item);
  addAudit("更新事项状态", {
    category: "事项变更",
    object: taskId,
    before: oldTask ? statusName(oldTask.status) : "未知",
    after: statusName(status),
    impact: oldTask ? oldTask.title : "事项状态变化"
  });
  render();
}

function confirmDeviation(taskId, result) {
  const oldTask = tasks.find((item) => item.id === taskId);
  tasks = tasks.map((item) => item.id === taskId ? { ...item, status: "completed", result } : item);
  addAudit("确认工作偏离结果", {
    category: "事项变更",
    object: taskId,
    before: oldTask ? `${statusName(oldTask.status)} / 未确认` : "未确认",
    after: `已完成 / ${result}`,
    impact: "主管确认 AI 工作量化是否偏离计划或方向"
  });
  render();
}

function handleAI() {
  const input = document.getElementById("aiInput");
  const text = input.value.trim();
  state.aiText = text;
  if (!text) return;

  const normalized = text.toLowerCase();
  let matched = allAvailableEntries().find((item) => text.includes(item.name));
  if (!matched && text.includes("报销")) matched = approvalEntries.find((item) => item.id === "reimburse");
  if (!matched && text.includes("请假")) matched = approvalEntries.find((item) => item.id === "leave");
  if (!matched && text.includes("外勤")) matched = approvalEntries.find((item) => item.id === "field");
  if (!matched && text.includes("出差")) matched = approvalEntries.find((item) => item.id === "travel");
  if (!matched && text.includes("权限")) matched = commonEntries.find((item) => item.id === "permission");
  if (!matched && (text.includes("转正") || text.includes("入职") || text.includes("调岗"))) {
    matched = roleEntries.hr.find((item) => text.includes(item.name)) || roleEntries.hr[1];
  }
  if (!matched && (text.includes("招聘") || text.includes("boss") || normalized.includes("disc"))) {
    if (!["boss", "hr", "manager"].includes(state.user.role)) {
      addAudit(`${state.user.name} 询问招聘体系，被权限规则限制。`);
      alert("当前角色只能查看本人相关招聘事项，不能进入招聘体系化看板。");
      return;
    }
    state.view = "recruiting";
    addAudit(`${state.user.name} 通过 AI 进入招聘体系化看板。`);
    render();
    return;
  }
  if (!matched && text.includes("项目")) matched = roleEntries.manager.find((item) => item.id === "project-progress") || commonEntries.find((item) => item.id === "todo");

  if (matched) {
    createTaskFromEntry(matched);
    state.aiText = "";
    return;
  }

  addAudit(`${state.user.name} 提交 AI 指令未识别：${text}`);
  alert("Demo 暂未识别该指令。可以试试：报销、权限、转正、项目、招聘。");
}

function addAudit(text, detail = {}) {
  state.audit.unshift({
    time: formatTime(new Date()),
    category: detail.category || "访问",
    actor: detail.actor || (state.user ? state.user.name : "系统"),
    action: text,
    object: detail.object || "-",
    before: detail.before || "-",
    after: detail.after || text,
    impact: detail.impact || "操作已记录",
    status: detail.status || "成功"
  });
}

function formatTime(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

render();
