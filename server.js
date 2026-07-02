const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadLocalEnv();

const port = Number(process.env.PORT || 3000);
const publicDir = __dirname;
const sessions = new Map();
const modelConfig = {
  providerName: process.env.MODEL_PROVIDER_NAME || "美团模型",
  apiUrl: normalizeModelApiUrl(process.env.MODEL_API_URL || process.env.OPENAI_API_URL || ""),
  apiKey: process.env.MODEL_API_KEY || process.env.OPENAI_API_KEY || "",
  model: process.env.MODEL_NAME || process.env.OPENAI_MODEL || ""
};

const accounts = {
  employee: account("员工", "employee", "普通员工", "产品及运营部", "product", "CPD 专员", "主管", "本人数据"),
  manager: account("主管", "manager", "主管", "产品及运营部", "product", "部门主管", "老板", "本人 + 团队 + 负责项目"),
  manger: account("主管", "manager", "主管", "产品及运营部", "product", "部门主管", "老板", "本人 + 团队 + 负责项目"),
  hr: account("HR", "hr", "HR", "人力行政部", "hr", "HRBP", "老板", "全员人事数据"),
  finance: account("财务", "finance", "财务", "财务部", "finance", "财务专员", "老板", "财务相关数据"),
  legal: account("法务接口人", "legal", "法务", "法务", "legal", "法务接口人", "老板", "合同模板、风险意见、归档合同"),
  assistant: account("总助", "assistant", "总助", "总裁办", "ceo_office", "总经理助理", "老板", "全局组织与授权管理"),
  boss: account("老板", "boss", "老板", "总裁办", "ceo_office", "总经理", "无", "全局汇总 + 授权明细")
};

const contractStages = [
  "submitted",
  "ai_review",
  "mentor_review",
  "legal_review",
  "assistant_review",
  "boss_review",
  "archived"
];

let contracts = [];
let contractProjects = [
  contractProject(
    "CP-1004",
    "客户合同协作项目",
    "员工",
    "collaboration",
    "合同文件.pdf",
    "客户合作项目",
    "待识别",
    {
      provider: "美团模型",
      model: "LongCat-2.0",
      approvalRemark: "AI 已完成条款读取，建议先完成产品、财务、法务反馈，再自动发起正式审批。",
      highRisks: [{ title: "账期与担保", reason: "付款周期和担保材料需财务/法务共同确认。", suggestion: "补充担保材料审核结论。" }],
      mediumRisks: [{ title: "KPI 与赔付", reason: "服务时效和赔偿边界需要产品确认。", suggestion: "在报价或附件中固化适用范围。" }],
      lowRisks: [{ title: "版本管理", reason: "合同和补充材料需要统一归档。", suggestion: "审批完成后进入合同档案。" }]
    }
  )
];
let tasks = [
  task("T-1001", "校园招聘项目立项与角色分工", "project", "project", "主管", "processing", "2026-07-08", "项目系统", "系统"),
  task("T-1002", "员工试用期转正评估", "probation", "hr", "主管", "pending", "2026-07-05", "人事系统", "系统"),
  task("T-1006", "员工月度工作量化低于阈值，请确认是否偏离计划", "work_deviation", "hr", "主管", "pending", "2026-07-06", "AI 工作台", "系统"),
  task("T-1007", "员工从销售支持组转入产品组，需完成权限交接", "org_change", "hr", "总助", "pending", "2026-07-06", "组织权限", "系统"),
  task("T-1003", "滴滴发票报销归入校园招聘项目", "expense", "finance", "财务", "need_info", "2026-07-03", "财务系统", "系统"),
  contractProjectTask("T-1004", "客户合同协作项目已创建，待产品/财务/法务反馈", "合同项目组", "processing", "2026-07-04", "collaboration", "员工", "AI 已写入风险备注，正式审批将在反馈确认后自动发起。", contractProjects[0]),
  task("T-1008", "合同归档风险意见复核", "legal", "legal", "法务接口人", "pending", "2026-07-05", "法务系统", "系统"),
  task("T-1005", "CPD 岗位人才画像和胜任力模型", "recruiting", "recruiting", "HR", "processing", "2026-07-10", "招聘工具", "系统")
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  setCors(req, res);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { message: error.message || "Server error" });
  }
});

server.listen(port, () => {
  console.log(`AI workbench demo backend: http://localhost:${port}`);
});

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeModelApiUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (raw.endsWith("/chat/completions")) return raw;
  if (raw.endsWith("/v1") || raw.endsWith("/openai/v1")) return `${raw}/chat/completions`;
  return raw;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, message: "backend online" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(req);
    const found = accounts[body.username];
    if (!found || found.password !== body.password) throw httpError(401, "账号或密码错误");
    const token = `demo-${body.username}-${Date.now()}`;
    sessions.set(token, body.username);
    sendJson(res, 200, { token, user: publicAccount(found, body.username) });
    return;
  }

  const user = requireUser(req);

  if (req.method === "GET" && url.pathname === "/api/me") {
    sendJson(res, 200, { user });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    sendJson(res, 200, { tasks: tasks.filter((item) => canSeeTask(user, item)) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readJson(req);
    if ((body.type || "") === "contract_project") {
      throw httpError(400, "请通过合同协作项目入口创建合同项目组。");
    }
    if (!canInitiateTaskType(user, body.type || "todo")) {
      throw httpError(403, "当前角色无权发起该流程。");
    }
    const newTask = task(
      nextId("T"),
      body.title || `${user.name} 发起：${body.entryId || "事项"}`,
      body.type || "todo",
      body.source || "ai_workbench",
      ownerFor(body.type || "todo"),
      "pending",
      "2026-07-08",
      body.sourceName || "AI 工作台",
      user.name
    );
    tasks.unshift(newTask);
    sendJson(res, 201, { task: newTask });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/contracts/projects") {
    if (!canInitiateContractProject(user)) {
      throw httpError(403, "当前角色不能创建合同协作项目。");
    }
    const submission = await readContractSubmission(req);
    const payload = await createContractProject(user, submission);
    sendJson(res, 201, payload);
    return;
  }

  const projectApprovalMatch = url.pathname.match(/^\/api\/contracts\/projects\/([^/]+)\/start-approval$/);
  if (req.method === "POST" && projectApprovalMatch) {
    const payload = startContractProjectApproval(user, projectApprovalMatch[1]);
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/approvals/contracts") {
    if (!canInitiateContractApproval(user)) {
      throw httpError(403, "当前角色只能处理合同待办或风险意见，不能发起或上传合同。");
    }
    const submission = await readContractSubmission(req);
    const payload = await createContractApproval(user, submission);
    sendJson(res, 201, payload);
    return;
  }

  const advanceMatch = url.pathname.match(/^\/api\/approvals\/contracts\/([^/]+)\/advance$/);
  if (req.method === "POST" && advanceMatch) {
    const result = advanceContract(user, advanceMatch[1]);
    sendJson(res, 200, result);
    return;
  }

  const contractMatch = url.pathname.match(/^\/api\/approvals\/contracts\/([^/]+)$/);
  if (req.method === "GET" && contractMatch) {
    const contract = contracts.find((item) => item.id === contractMatch[1]);
    if (!contract) throw httpError(404, "合同不存在");
    const relatedTask = tasks.find((item) => item.contractId === contract.id);
    if (!canSeeTask(user, relatedTask)) throw httpError(403, "当前阶段无权查看该合同");
    sendJson(res, 200, { contract, task: relatedTask });
    return;
  }

  throw httpError(404, "接口不存在");
}

function account(name, role, roleName, department, departmentCode, position, manager, scope) {
  return { password: "123456", name, role, roleName, department, departmentCode, position, manager, scope };
}

function publicAccount(item, username) {
  const { password, ...rest } = item;
  return { ...rest, username };
}

function task(id, title, type, source, owner, status, due, sourceName, initiator) {
  return { id, title, type, source, owner, status, due, sourceName, initiator, result: "" };
}

function contractTask(id, title, owner, status, due, approvalStage, initiator, result) {
  return {
    ...task(id, title, "contract", "legal", owner, status, due, "合同审批", initiator),
    approvalStage,
    result
  };
}

function contractProjectTask(id, title, owner, status, due, projectStage, initiator, result, project) {
  return {
    ...task(id, title, "contract_project", "project", owner, status, due, "合同协作项目", initiator),
    projectStage,
    contractProjectId: project.id,
    contractProject: publicContractProject(project),
    analysis: project.analysis,
    result
  };
}

function contractProject(id, title, initiator, projectStage, fileName, projectName, amount, analysis) {
  return {
    id,
    title,
    fileName,
    projectName,
    amount,
    initiator,
    projectStage,
    currentNode: projectStage === "formal_approval" ? "正式审批中" : "部门反馈汇总",
    analysis,
    groupMembers: contractProjectMembers(initiator),
    feedbacks: contractProjectFeedbacks(),
    actions: [
      "补齐合同/补充材料版本",
      "产品确认 KPI、报价边界和赔付上限",
      "财务确认账期、结算币种和担保材料",
      "法务确认免责、争议解决和签署主体",
      "反馈确认后自动发起正式审批"
    ],
    lifecycle: [
      "合同档案归档",
      "交付节点同步项目管理",
      "账期/担保/赔付进入履约监控",
      "风险事项持续提醒责任人"
    ],
    audit: [
      `${initiator} 创建合同协作项目`,
      "AI 完成合同文本读取并生成风险备注",
      "系统创建项目组并分派产品、财务、法务反馈事项"
    ]
  };
}

function contractProjectMembers(initiator) {
  return [
    { role: "业务发起人", owner: initiator, responsibility: "提交合同、对方反馈和商务背景" },
    { role: "产品", owner: "产品负责人", responsibility: "确认 KPI、报价边界、赔付口径" },
    { role: "财务", owner: "财务", responsibility: "确认账期、结算、担保材料" },
    { role: "法务", owner: "法务接口人", responsibility: "确认条款、免责、争议解决和签署主体" },
    { role: "AI", owner: "合同风险分析", responsibility: "读取合同并输出高/中/低风险备注" }
  ];
}

function contractProjectFeedbacks() {
  return [
    { role: "产品", status: "待确认", focus: "服务范围、KPI、报价有效期、赔偿边界" },
    { role: "财务", status: "待确认", focus: "账期、结算币种、担保材料、回款风险" },
    { role: "法务", status: "待确认", focus: "免责条款、保密、争议解决、签署主体" },
    { role: "业务", status: "跟进中", focus: "客户反馈、补充材料、最终版本确认" }
  ];
}

function publicContractProject(project) {
  return {
    id: project.id,
    title: project.title,
    fileName: project.fileName,
    projectName: project.projectName,
    amount: project.amount,
    initiator: project.initiator,
    projectStage: project.projectStage,
    currentNode: project.currentNode,
    groupMembers: project.groupMembers,
    feedbacks: project.feedbacks,
    actions: project.actions,
    lifecycle: project.lifecycle,
    audit: project.audit,
    approvalTaskId: project.approvalTaskId || "",
    contractId: project.contractId || ""
  };
}

async function createContractProject(user, body) {
  const contractText = (await extractContractText(body)).trim();
  if (contractText.length < 20) {
    throw httpError(400, "请上传可解析的合同文本，或在合同文本框粘贴合同内容。");
  }
  const modelResult = await analyzeContractWithModel(contractText, {
    fileName: body.fileName || "合同文件",
    project: body.project || "客户合作项目",
    amount: body.amount || "待识别"
  });
  const project = contractProject(
    nextId("CP"),
    body.title || "客户合同协作项目",
    user.name,
    "collaboration",
    body.fileName || "合同文件.txt",
    body.project || "客户合作项目",
    body.amount || "待识别",
    modelResult
  );
  project.extractedTextLength = contractText.length;
  const newTask = contractProjectTask(
    nextId("T"),
    `${user.name} 创建：合同协作项目（待部门反馈）`,
    "合同项目组",
    "processing",
    "2026-07-08",
    "collaboration",
    user.name,
    `${modelResult.provider}已生成风险备注；系统已创建项目组，先沉淀部门反馈，再进入正式审批。`,
    project
  );
  project.taskId = newTask.id;
  contractProjects.unshift(project);
  tasks.unshift(newTask);
  return {
    project: publicContractProject(project),
    task: newTask,
    analysis: modelResult,
    message: "合同协作项目已创建，正式审批将在反馈确认后发起"
  };
}

async function createContractApproval(user, body) {
  const contractText = (await extractContractText(body)).trim();
  if (contractText.length < 20) {
    throw httpError(400, "请上传可解析的合同文本，或在合同文本框粘贴合同内容。");
  }
  const modelResult = await analyzeContractWithModel(contractText, {
    fileName: body.fileName || "合同文件",
    project: body.project || "未关联项目",
    amount: body.amount || "待识别"
  });
  const contract = {
    id: nextId("C"),
    title: body.title || "客户合同审批",
    fileName: body.fileName || "合同文件.txt",
    project: body.project || "未关联项目",
    amount: body.amount || "待识别",
    initiator: user.name,
    approvalStage: "ai_review",
    modelProvider: modelResult.provider,
    modelName: modelResult.model,
    riskNotes: modelResult.riskNotes,
    approvalRemark: modelResult.approvalRemark,
    extractedTextLength: contractText.length,
    audit: [
      `${user.name} 提交合同`,
      `合同审批助理调用${modelResult.provider}完成风险分析`
    ]
  };
  const newTask = {
    ...contractTask(
      nextId("T"),
      `${user.name} 发起：合同审批（AI 预审中）`,
      "合同审批助理",
      "processing",
      "2026-07-08",
      "ai_review",
      user.name,
      `${modelResult.provider}已输出低/中/高风险，当前仅发起人可见；老板暂不可见。`
    ),
    contractId: contract.id,
    analysis: modelResult
  };
  contracts.unshift(contract);
  tasks.unshift(newTask);
  return { contract, task: newTask, analysis: modelResult, message: "合同已进入 AI 预审，老板暂不可见" };
}

async function extractContractText(body) {
  if (body.contractText && String(body.contractText).trim().length >= 20) {
    return String(body.contractText);
  }
  if (!body.fileBuffer) return "";

  const fileName = String(body.fileName || "").toLowerCase();
  if (fileName.endsWith(".pdf")) {
    const pdfParse = requireOptional("pdf-parse", "PDF 解析依赖未安装，请先执行 npm install。");
    const result = await pdfParse(body.fileBuffer);
    return result.text || "";
  }
  if (fileName.endsWith(".docx")) {
    const mammoth = requireOptional("mammoth", "DOCX 解析依赖未安装，请先执行 npm install。");
    const result = await mammoth.extractRawText({ buffer: body.fileBuffer });
    return result.value || "";
  }
  if (fileName.endsWith(".doc")) {
    throw httpError(400, "暂不支持旧版 .doc，请转为 .docx、PDF 或粘贴合同文本。");
  }
  return body.fileBuffer.toString("utf8");
}

function requireOptional(packageName, message) {
  try {
    return require(packageName);
  } catch {
    throw httpError(500, message);
  }
}

async function analyzeContractWithModel(contractText, meta) {
  if (!modelConfig.apiKey || !modelConfig.apiUrl || !modelConfig.model) {
    throw httpError(503, "模型未配置完整：请设置 MODEL_API_KEY / MODEL_API_URL / MODEL_NAME 后再提交合同。");
  }

  const systemPrompt = [
    "你是企业合同审批的风险分析模型，只输出 JSON。",
    "你需要把合同风险分为 highRisks、mediumRisks、lowRisks 三类。",
    "每条风险必须包含 title、clause、reason、suggestion 四个字段。",
    "请站在企业内部审批角度给出可写入审批备注的结论，不能编造合同中不存在的条款。",
    "如果某类风险没有发现，返回空数组。",
    "不要输出 Markdown，不要输出 JSON 之外的文字。"
  ].join("\n");
  const userPrompt = [
    `文件名：${meta.fileName}`,
    `项目：${meta.project}`,
    `金额：${meta.amount}`,
    "",
    "请分析以下合同文本：",
    contractText.slice(0, 24000)
  ].join("\n");

  const response = await fetch(modelConfig.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${modelConfig.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, payload.error?.message || payload.message || "模型调用失败");
  }

  const content = payload.choices?.[0]?.message?.content || payload.content;
  if (!content) throw httpError(502, "模型未返回可解析内容");

  let parsed;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    throw httpError(502, "模型返回不是合法 JSON");
  }

  const highRisks = normalizeRiskItems(parsed.highRisks);
  const mediumRisks = normalizeRiskItems(parsed.mediumRisks);
  const lowRisks = normalizeRiskItems(parsed.lowRisks);
  return {
    provider: modelConfig.providerName,
    model: modelConfig.model,
    highRisks,
    mediumRisks,
    lowRisks,
    riskNotes: [
      ...highRisks.map((item) => ({ level: "高", text: `${item.title}：${item.reason} 建议：${item.suggestion}` })),
      ...mediumRisks.map((item) => ({ level: "中", text: `${item.title}：${item.reason} 建议：${item.suggestion}` })),
      ...lowRisks.map((item) => ({ level: "低", text: `${item.title}：${item.reason} 建议：${item.suggestion}` }))
    ],
    approvalRemark: buildApprovalRemark(highRisks, mediumRisks, lowRisks)
  };
}

function normalizeRiskItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item) => ({
    title: String(item.title || "风险项").slice(0, 80),
    clause: String(item.clause || "未标明条款").slice(0, 160),
    reason: String(item.reason || "模型未说明原因").slice(0, 220),
    suggestion: String(item.suggestion || "请人工复核").slice(0, 220)
  }));
}

function extractJsonObject(content) {
  const text = String(content || "").trim();
  if (text.startsWith("{") && text.endsWith("}")) return text;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function buildApprovalRemark(highRisks, mediumRisks, lowRisks) {
  const total = highRisks.length + mediumRisks.length + lowRisks.length;
  if (!total) return "模型未识别到明确风险项，仍需按合同审批链人工复核。";
  return `模型识别高风险 ${highRisks.length} 项、中风险 ${mediumRisks.length} 项、低风险 ${lowRisks.length} 项；审批链需依次经过带教/主管、法务、总助，前置审核通过后才进入老板终审。`;
}

function advanceContract(user, contractId) {
  const contract = contracts.find((item) => item.id === contractId);
  const relatedTask = tasks.find((item) => item.contractId === contractId);
  if (!contract || !relatedTask) throw httpError(404, "合同不存在");

  const currentIndex = contractStages.indexOf(contract.approvalStage);
  const currentStage = contract.approvalStage;
  if (currentStage === "mentor_review" && user.role !== "manager") throw httpError(403, "需带教/主管审核");
  if (currentStage === "legal_review" && user.role !== "legal") throw httpError(403, "需法务审核");
  if (currentStage === "assistant_review" && user.role !== "assistant") throw httpError(403, "需总助复核");
  if (currentStage === "boss_review" && user.role !== "boss") throw httpError(403, "需老板终审");

  const nextStage = contractStages[Math.min(currentIndex + 1, contractStages.length - 1)];
  const nextOwner = {
    mentor_review: "主管",
    legal_review: "法务接口人",
    assistant_review: "总助",
    boss_review: "老板",
    archived: "系统"
  }[nextStage] || "合同审批助理";

  contract.approvalStage = nextStage;
  contract.audit.push(`${user.name} 推进到 ${nextStage}`);
  relatedTask.approvalStage = nextStage;
  relatedTask.owner = nextOwner;
  relatedTask.status = nextStage === "archived" ? "completed" : "pending";
  relatedTask.title = titleForContractStage(contract.initiator, nextStage);
  relatedTask.result = nextStage === "boss_review"
    ? "带教/主管、法务、总助均已审核完成，进入老板终审待办。"
    : "审批阶段已更新。";

  return { contract, task: relatedTask };
}

function startContractProjectApproval(user, projectId) {
  const project = contractProjects.find((item) => item.id === projectId);
  if (!project) throw httpError(404, "合同协作项目不存在");
  if (!canStartContractProjectApproval(user, project)) {
    throw httpError(403, "当前角色不能发起该合同项目的正式审批。");
  }
  if (project.approvalTaskId) {
    const existingTask = tasks.find((item) => item.id === project.approvalTaskId);
    return { project: publicContractProject(project), task: existingTask, message: "正式审批已存在" };
  }

  const contract = {
    id: nextId("C"),
    title: project.title.replace("协作项目", "正式审批"),
    fileName: project.fileName,
    project: project.projectName,
    amount: project.amount,
    initiator: project.initiator,
    approvalStage: "mentor_review",
    modelProvider: project.analysis.provider,
    modelName: project.analysis.model,
    riskNotes: project.analysis.riskNotes,
    approvalRemark: project.analysis.approvalRemark,
    audit: [
      ...project.audit,
      `${user.name} 确认项目组反馈并发起正式审批`
    ]
  };
  const approvalTask = {
    ...contractTask(
      nextId("T"),
      `${project.initiator} 发起：合同正式审批待带教/主管审核`,
      "主管",
      "pending",
      "2026-07-09",
      "mentor_review",
      project.initiator,
      "项目组反馈已沉淀，正式审批从带教/主管节点开始。"
    ),
    contractId: contract.id,
    analysis: project.analysis
  };
  const projectTask = tasks.find((item) => item.contractProjectId === project.id);

  project.projectStage = "formal_approval";
  project.currentNode = "正式审批中";
  project.approvalTaskId = approvalTask.id;
  project.contractId = contract.id;
  project.audit.push(`${user.name} 发起正式审批`);
  if (projectTask) {
    projectTask.projectStage = project.projectStage;
    projectTask.status = "processing";
    projectTask.owner = "主管";
    projectTask.result = "项目组反馈已确认，正式审批已自动生成。";
    projectTask.contractProject = publicContractProject(project);
  }

  contracts.unshift(contract);
  tasks.unshift(approvalTask);
  return {
    project: publicContractProject(project),
    task: approvalTask,
    projectTask,
    message: "正式审批已自动创建"
  };
}

function titleForContractStage(initiator, stage) {
  return {
    ai_review: `${initiator} 发起：合同审批（AI 预审中）`,
    mentor_review: `${initiator} 发起：合同审批待带教/主管审核`,
    legal_review: `${initiator} 发起：合同审批待法务审核`,
    assistant_review: `${initiator} 发起：合同审批待总助复核`,
    boss_review: `${initiator} 发起：合同审批待老板终审`,
    archived: `${initiator} 发起：合同审批已归档`
  }[stage] || `${initiator} 发起：合同审批`;
}

function ownerFor(type) {
  if (["expense", "expense_review", "invoice", "payment", "cost", "project_cost"].includes(type)) return "财务";
  if (["org_change", "handover"].includes(type)) return "总助";
  if (["onboard", "probation", "transfer", "resign", "hr_file"].includes(type)) return "HR";
  if (["contract_project"].includes(type)) return "合同项目组";
  if (["contract"].includes(type)) return "合同审批助理";
  if (["recruiting"].includes(type)) return "HR";
  return "主管";
}

function canSeeTask(user, item) {
  if (!item) return false;
  if (item.type === "contract_project") return canSeeContractProjectTask(user, item);
  if (item.type === "contract" || item.approvalStage) return canSeeContractTask(user, item);
  if (user.role === "boss") return true;
  if (user.role === "assistant") return ["org_change", "handover"].includes(item.type) || ["hr", "project", "ai_workbench"].includes(item.source);
  if (user.role === "finance") return item.source === "finance" || item.type === "expense";
  if (user.role === "legal") return item.source === "legal" || ["legal", "risk"].includes(item.type);
  if (user.role === "hr") return ["hr", "recruiting"].includes(item.source) || ["probation", "onboard", "transfer"].includes(item.type);
  if (user.role === "manager") return ["project", "hr", "ai_workbench"].includes(item.source) || item.approvalStage === "mentor_review";
  return ["finance", "ai_workbench"].includes(item.source) || item.initiator === user.name;
}

function canSeeContractTask(user, item) {
  if (item.initiator === user.name || item.initiator === user.username) return true;
  if (["submitted", "ai_review"].includes(item.approvalStage)) return false;
  if (item.approvalStage === "mentor_review") return user.role === "manager";
  if (item.approvalStage === "legal_review") return user.role === "legal";
  if (item.approvalStage === "assistant_review") return user.role === "assistant";
  if (item.approvalStage === "boss_review") return ["boss", "assistant"].includes(user.role);
  if (item.approvalStage === "archived") return ["boss", "assistant", "manager", "legal"].includes(user.role);
  return false;
}

function canSeeContractProjectTask(user, item) {
  if (item.initiator === user.name || item.initiator === user.username) return true;
  return ["manager", "finance", "legal", "assistant", "boss"].includes(user.role);
}

function canInitiateContractApproval(user) {
  return ["employee", "manager"].includes(user.role);
}

function canInitiateContractProject(user) {
  return ["employee", "manager"].includes(user.role);
}

function canStartContractProjectApproval(user, project) {
  if (user.name === project.initiator || user.username === project.initiator) return true;
  return ["manager", "legal", "assistant"].includes(user.role);
}

function canInitiateTaskType(user, type) {
  const rolesByType = {
    expense: "staff",
    leave: "staff",
    field: "staff",
    travel: "staff",
    attendance: "staff",
    approval: "staff",
    meeting: "all",
    schedule: "all",
    todo: "all",
    permission: ["employee", "manager", "hr", "finance", "legal"],
    contract: ["employee", "manager"],
    contract_project: ["employee", "manager"],
    payment: ["finance"],
    expense_review: ["finance"],
    invoice: ["finance"],
    cost: ["finance"],
    project_cost: ["finance"],
    onboard: ["hr"],
    probation: ["hr"],
    transfer: ["hr"],
    resign: ["hr"],
    hr_file: ["hr"],
    recruiting: ["boss", "hr", "manager"],
    org_change: ["boss", "assistant"],
    handover: ["boss", "assistant"],
    project: ["employee", "manager", "assistant", "boss"],
    work_deviation: ["manager", "boss"],
    performance: ["boss"],
    risk_overview: ["boss"],
    legal: ["legal"],
    risk: ["legal", "boss", "assistant"]
  };
  const allowed = rolesByType[type] || "staff";
  if (allowed === "all") return true;
  if (allowed === "staff") return user.role !== "boss";
  return allowed.includes(user.role);
}

function requireUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const username = sessions.get(token);
  if (!username || !accounts[username]) throw httpError(401, "请先登录");
  return publicAccount(accounts[username], username);
}

async function readContractSubmission(req) {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return readMultipartContract(req, contentType);
  }
  if (contentType.includes("text/plain")) {
    const buffer = await readRawBody(req, 5 * 1024 * 1024);
    return { title: "客户合同审批", fileName: "contract.txt", contractText: buffer.toString("utf8") };
  }
  return readJson(req);
}

async function readMultipartContract(req, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw httpError(400, "上传格式错误：缺少 multipart boundary");
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const raw = await readRawBody(req, 8 * 1024 * 1024);
  const parts = raw.toString("binary").split(`--${boundary}`);
  const fields = {};
  let uploadedFile = null;

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, "");
    if (!trimmed || trimmed === "--\r\n" || trimmed === "--") continue;
    const [rawHeaders, ...bodyParts] = trimmed.split("\r\n\r\n");
    if (!rawHeaders || !bodyParts.length) continue;
    const bodyBinary = bodyParts.join("\r\n\r\n").replace(/\r\n--$/, "").replace(/\r\n$/, "");
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;\s*([^\r\n]+)/i);
    if (!disposition) continue;
    const name = (disposition[1].match(/name="([^"]+)"/) || [])[1];
    const fileName = (disposition[1].match(/filename="([^"]*)"/) || [])[1];
    if (!name) continue;
    const contentBuffer = Buffer.from(bodyBinary, "binary");
    if (fileName) {
      uploadedFile = { fileName, contentBuffer };
    } else {
      fields[name] = contentBuffer.toString("utf8").trim();
    }
  }

  const contractText = fields.contractText || "";
  const fileName = fields.fileName || uploadedFile?.fileName || "contract.txt";
  return {
    title: fields.title || "客户合同审批",
    project: fields.project || "未关联项目",
    amount: fields.amount || "待识别",
    fileName,
    contractText,
    fileBuffer: uploadedFile?.contentBuffer
  };
}

function readJson(req) {
  return readRawBody(req, 5 * 1024 * 1024).then((bodyBuffer) => {
    const body = bodyBuffer.toString("utf8");
    if (!body) return {};
    try {
      return JSON.parse(body);
    } catch {
      throw httpError(400, "JSON 格式错误");
    }
  });
}

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(httpError(413, "请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function serveStatic(res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, cleanPath));
  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(content);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  }[ext] || "application/octet-stream";
}

function nextId(prefix) {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  if (statusCode === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
