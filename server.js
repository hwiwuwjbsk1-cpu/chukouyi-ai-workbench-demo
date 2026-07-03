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

const skillRegistry = {
  "invoice-ocr": skillDef("发票识别与命名", "提取金额、日期、商户、税号、项目备注，并生成规范附件名。"),
  "expense-policy-check": skillDef("报销规则校验", "检查费用类型、附件完整性、项目归属和提交前待确认项。"),
  "project-cost-classify": skillDef("项目费用归类", "把费用归到对应项目、部门和费用科目。"),
  "contract-intake": skillDef("合同材料读取", "读取合同、邮件摘要和附件，提取条款、版本和待确认事项。"),
  "contract-risk": skillDef("合同风险分析", "按高/中/低风险输出可写入审批备注的结论。"),
  "contract-group": skillDef("合同项目组创建", "按风险项自动拉齐业务、产品、财务、法务反馈事项。"),
  "approval-routing": skillDef("审批链路路由", "根据角色、风险等级和前置反馈生成后续审批链。"),
  "lifecycle-monitor": skillDef("履约风险监控", "把账期、担保、KPI、赔付和交付节点转为后续监控事项。"),
  "meeting-schedule": skillDef("日程会议协调", "协调参会人、会议室、时间段和会议资源。"),
  "minutes-extract": skillDef("会议纪要提取", "从会议目的或纪要中提取结论、待办和负责人。"),
  "visitor-intake": skillDef("访客接待引导", "根据访客、预约和会议目的生成行政接待待办。"),
  "work-summary": skillDef("日报周报汇总", "从日报文本和事项数据中整理完成事项、延期事项和下步计划。"),
  "workload-score": skillDef("工作量化评分", "根据完成量、延期、协作和目标偏离生成量化分与提醒对象。")
};

const eventTriggerRules = {
  "invoice.uploaded": eventRule("上传发票", "expense-assistant", "报销助理", ["invoice-ocr", "expense-policy-check", "project-cost-classify"], "报销基础表单 / 事项中心"),
  "contract.uploaded": eventRule("上传合同/邮件材料", "contract-approval-assistant", "合同审批助理", ["contract-intake", "contract-risk", "contract-group", "approval-routing", "lifecycle-monitor"], "合同协作项目 / 审批中心 / 履约监控"),
  "meeting.created": eventRule("创建会议/预订会议室", "schedule-meeting-assistant", "日程和会议助理", ["meeting-schedule", "minutes-extract", "visitor-intake"], "会议室预订 / 日程 / 会后事项"),
  "daily_report.submitted": eventRule("提交日报", "report-assistant", "日报周报助理", ["work-summary", "workload-score", "minutes-extract"], "日报量化 / 主管提醒 / 事项中心")
};

const skillHandlers = {
  "invoice-ocr": runInvoiceOcrSkill,
  "expense-policy-check": runExpensePolicyCheckSkill,
  "project-cost-classify": runProjectCostClassifySkill,
  "contract-intake": runContractIntakeSkill,
  "contract-risk": runContractRiskSkill,
  "contract-group": runContractGroupSkill,
  "approval-routing": runApprovalRoutingSkill,
  "lifecycle-monitor": runLifecycleMonitorSkill,
  "meeting-schedule": runMeetingScheduleSkill,
  "minutes-extract": runMinutesExtractSkill,
  "visitor-intake": runVisitorIntakeSkill,
  "work-summary": runWorkSummarySkill,
  "workload-score": runWorkloadScoreSkill
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
let automationEvents = [];
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

  if (req.method === "GET" && url.pathname === "/api/automation/rules") {
    if (!canViewAutomationGovernance(user)) throw httpError(403, "当前角色不能查看机器人编排规则。");
    sendJson(res, 200, { rules: automationRuleList() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/skills") {
    if (!canViewAutomationGovernance(user)) throw httpError(403, "当前角色不能查看 Skills。");
    sendJson(res, 200, { skills: Object.keys(skillRegistry).map((id) => publicSkill(id, true)) });
    return;
  }

  const skillUploadMatch = url.pathname.match(/^\/api\/skills\/([^/]+)\/upload$/);
  if (req.method === "POST" && skillUploadMatch) {
    if (!canViewAutomationGovernance(user)) throw httpError(403, "当前角色不能替换 Skills。");
    const skillId = decodeURIComponent(skillUploadMatch[1]);
    const upload = await readSkillUpload(req);
    const skill = updateSkillDefinition(skillId, user, upload);
    sendJson(res, 200, { skill: publicSkill(skillId, true), message: `${skill.name} 已更新到 v${skill.version}` });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/automation/events") {
    const visibleEvents = automationEvents
      .filter((item) => canSeeAutomationEvent(user, item))
      .slice(0, 30)
      .map(publicAutomationEvent);
    sendJson(res, 200, { events: visibleEvents });
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

  if (req.method === "POST" && url.pathname === "/api/expenses/invoices/autofill") {
    if (!canInitiateTaskType(user, "expense")) {
      throw httpError(403, "当前角色不能发起报销自动识别。");
    }
    const submission = await readInvoiceSubmission(req);
    const payload = createInvoiceAutofill(user, submission);
    sendJson(res, 201, payload);
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

  if (req.method === "POST" && url.pathname === "/api/meetings") {
    if (!canInitiateTaskType(user, "meeting")) {
      throw httpError(403, "当前角色不能创建会议。");
    }
    const body = await readJson(req);
    const payload = createMeetingWorkflow(user, body);
    sendJson(res, 201, payload);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reports/daily") {
    if (!canInitiateTaskType(user, "daily_report")) {
      throw httpError(403, "当前角色不能提交日报。");
    }
    const body = await readJson(req);
    const payload = createDailyReportWorkflow(user, body);
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

function skillDef(name, purpose, options = {}) {
  return {
    name,
    purpose,
    version: options.version || 1,
    updatedAt: options.updatedAt || nowDisplay(),
    updatedBy: options.updatedBy || "系统",
    sourceName: options.sourceName || "backend-default",
    inputSchema: options.inputSchema || "业务事件上下文、发起人、业务对象和已识别字段",
    outputSchema: options.outputSchema || "结构化结果、待确认项、写回对象和执行摘要",
    writesTo: options.writesTo || "业务对象 / 事项中心",
    prompt: options.prompt || [
      `# ${name}`,
      "",
      `目标：${purpose}`,
      "输入：业务事件上下文、角色权限和业务对象字段。",
      "输出：可写回后端业务对象的结构化结果，必须包含置信度、待确认项和处理摘要。",
      "边界：不得越权读取数据，不直接替代人工审批。"
    ].join("\n")
  };
}

function eventRule(businessAction, robotId, robotName, skills, outputTarget) {
  return { businessAction, robotId, robotName, skills, outputTarget };
}

function task(id, title, type, source, owner, status, due, sourceName, initiator) {
  return { id, title, type, source, owner, status, due, sourceName, initiator, result: "" };
}

function automationRuleList() {
  return Object.entries(eventTriggerRules).map(([eventType, rule]) => ({
    eventType,
    businessAction: rule.businessAction,
    robotId: rule.robotId,
    robotName: rule.robotName,
    skills: rule.skills.map((id) => publicSkill(id)),
    outputTarget: rule.outputTarget
  }));
}

function publicSkill(skillId, includePrompt = false) {
  const skill = skillRegistry[skillId] || skillDef(skillId, "待定义");
  return {
    id: skillId,
    name: skill.name,
    purpose: skill.purpose,
    version: skill.version,
    updatedAt: skill.updatedAt,
    updatedBy: skill.updatedBy,
    sourceName: skill.sourceName,
    inputSchema: skill.inputSchema,
    outputSchema: skill.outputSchema,
    writesTo: skill.writesTo,
    handlerName: skillHandlers[skillId]?.name || "runGenericSkill",
    promptPreview: String(skill.prompt || "").slice(0, 160),
    ...(includePrompt ? { prompt: skill.prompt } : {})
  };
}

function triggerBusinessEvent(user, eventType, context = {}) {
  const rule = eventTriggerRules[eventType];
  if (!rule) throw httpError(500, `未配置后端事件规则：${eventType}`);
  const event = {
    id: nextId("EVT"),
    eventType,
    businessAction: rule.businessAction,
    robotId: rule.robotId,
    robotName: rule.robotName,
    actor: user.name,
    actorRole: user.roleName || user.role,
    objectType: context.objectType || "",
    objectId: context.objectId || "",
    taskId: context.taskId || "",
    inputSummary: context.inputSummary || [],
    outputTarget: context.outputTarget || rule.outputTarget,
    outputs: context.outputs || [],
    skills: rule.skills.map((id, index) => executeSkill(id, eventType, context, index)),
    status: "completed",
    createdAt: nowDisplay()
  };
  automationEvents.unshift(event);
  return event;
}

function defaultSkillResult(skillId, index) {
  const name = skillRegistry[skillId]?.name || skillId;
  return `${name} 已完成，第 ${index + 1} 步结果已写入后续业务对象。`;
}

function executeSkill(skillId, eventType, context, index) {
  const skill = skillRegistry[skillId] || skillDef(skillId, "待定义");
  const handler = skillHandlers[skillId] || runGenericSkill;
  const execution = handler({ skillId, skill, eventType, context, index });
  const result = execution.result || context.skillResults?.[skillId] || defaultSkillResult(skillId, index);
  return {
    id: skillId,
    name: skill.name,
    purpose: skill.purpose,
    version: skill.version,
    sourceName: skill.sourceName,
    updatedAt: skill.updatedAt,
    status: "completed",
    eventType,
    handlerName: handler.name || "runGenericSkill",
    inputSchema: skill.inputSchema,
    outputSchema: skill.outputSchema,
    writesTo: skill.writesTo,
    result,
    structuredOutput: execution.structuredOutput || {},
    outputSummary: execution.outputSummary || `${skill.name} v${skill.version} 已执行并回写：${context.outputTarget || "业务对象"}`
  };
}

function runGenericSkill({ skillId, context, index }) {
  return {
    result: context.skillResults?.[skillId] || defaultSkillResult(skillId, index),
    structuredOutput: {
      status: "completed",
      target: context.outputTarget || "业务对象"
    }
  };
}

function runInvoiceOcrSkill({ skillId, context }) {
  const merchant = readContextValue(context.outputs, "商户") || "待确认";
  const amount = readContextValue(context.outputs, "金额") || "待确认";
  const attachmentName = readContextValue(context.outputs, "附件命名") || "待生成";
  return {
    result: context.skillResults?.[skillId] || `识别商户 ${merchant}、金额 ${amount}`,
    structuredOutput: {
      fields: { merchant, amount, attachmentName },
      confidence: merchant === "待确认" ? 0.58 : 0.88,
      nextAction: "回填报销基础表单，等待人工确认"
    },
    outputSummary: `发票字段已识别：${merchant} / ${amount}`
  };
}

function runExpensePolicyCheckSkill({ skillId, context }) {
  const amount = readContextValue(context.outputs, "金额") || "待确认";
  return {
    result: context.skillResults?.[skillId] || "已生成提交前校验项",
    structuredOutput: {
      requiredChecks: ["金额确认", "项目归属确认", "附件完整性确认", "费用类型确认"],
      amount,
      approvalHint: amount === "待确认" ? "金额低置信，需要人工补充" : "金额已识别，可进入提交确认"
    },
    outputSummary: "报销规则校验项已生成"
  };
}

function runProjectCostClassifySkill({ skillId, context }) {
  const projectNote = readContextValue(context.inputSummary, "项目备注") || readContextValue(context.outputs, "项目") || "待选择项目";
  return {
    result: context.skillResults?.[skillId] || `归类到 ${projectNote}`,
    structuredOutput: {
      project: projectNote,
      costCategory: projectNote.includes("招聘") ? "招聘项目费用" : "项目费用",
      department: "按发起人部门归集"
    },
    outputSummary: `费用归类完成：${projectNote}`
  };
}

function runContractIntakeSkill({ skillId, context }) {
  const fileName = readContextValue(context.inputSummary, "文件") || "合同材料";
  const project = readContextValue(context.inputSummary, "项目") || "客户合作项目";
  const textLength = readContextValue(context.inputSummary, "文本长度") || "0";
  return {
    result: context.skillResults?.[skillId] || `读取合同材料，文本长度 ${textLength}`,
    structuredOutput: {
      fileName,
      project,
      textLength,
      materialTypes: ["合同正文", "邮件沟通", "补充附件"]
    },
    outputSummary: `合同材料读取完成：${fileName}`
  };
}

function runContractRiskSkill({ skillId, context }) {
  const riskRemark = context.skillResults?.[skillId] || "已生成合同风险备注";
  return {
    result: riskRemark,
    structuredOutput: {
      riskLevels: ["高风险", "中风险", "低风险"],
      approvalRemark: riskRemark,
      writeTo: "审批备注",
      requiresHumanReview: true
    },
    outputSummary: "合同风险已按高/中/低写入审批备注"
  };
}

function runContractGroupSkill({ skillId, context }) {
  const projectId = readContextValue(context.outputs, "合同协作项目") || context.objectId || "待创建";
  const directApproval = context.objectType === "contract_approval";
  return {
    result: context.skillResults?.[skillId] || (directApproval ? "兼容正式审批事件" : "合同项目组已创建"),
    structuredOutput: {
      projectId,
      members: directApproval ? ["发起人", "主管", "法务", "总助"] : ["发起人", "产品", "财务", "法务", "AI"],
      feedbackObjects: directApproval ? [] : ["产品反馈", "财务反馈", "法务反馈", "业务反馈"]
    },
    outputSummary: directApproval ? "正式审批事件已保留项目组兼容记录" : `合同项目组已创建：${projectId}`
  };
}

function runApprovalRoutingSkill({ skillId, context }) {
  const isContract = context.eventType === "contract.uploaded";
  const chain = isContract
    ? ["AI 预审", "主管/带教", "法务", "总助", "老板终审"]
    : ["发起人确认", "直属主管", "归口部门"];
  return {
    result: context.skillResults?.[skillId] || `审批链路：${chain.join(" -> ")}`,
    structuredOutput: {
      chain,
      currentGate: chain[0],
      bossVisibleAt: isContract ? "总助审核通过后" : "按事项权限"
    },
    outputSummary: `审批链路已生成：${chain.join(" -> ")}`
  };
}

function runLifecycleMonitorSkill({ skillId, context }) {
  return {
    result: context.skillResults?.[skillId] || "已生成履约监控事项",
    structuredOutput: {
      watchItems: ["合同归档", "交付节点", "账期", "担保材料", "KPI", "赔付边界"],
      objectId: context.objectId || "",
      status: "待审批完成后持续监控"
    },
    outputSummary: "履约风险监控项已预置"
  };
}

function runMeetingScheduleSkill({ skillId, context }) {
  const title = readContextValue(context.inputSummary, "主题") || "内部会议";
  const meetingTime = readContextValue(context.inputSummary, "时间") || "待确认";
  const room = readContextValue(context.inputSummary, "会议室") || "待确认";
  const participants = readContextValue(context.inputSummary, "参会人") || "相关同事";
  return {
    result: context.skillResults?.[skillId] || `生成会议并预订 ${room}`,
    structuredOutput: {
      title,
      meetingTime,
      room,
      participants,
      calendarStatus: "待同步日程"
    },
    outputSummary: `会议协调完成：${room} / ${meetingTime}`
  };
}

function runMinutesExtractSkill({ skillId, context }) {
  const source = context.eventType === "daily_report.submitted" ? "日报文本" : "会议目的/纪要";
  return {
    result: context.skillResults?.[skillId] || `从${source}提取待办`,
    structuredOutput: {
      source,
      actionItems: context.eventType === "daily_report.submitted"
        ? ["提取明日计划", "识别延期事项", "沉淀月度总结素材"]
        : ["提取会议结论", "识别负责人", "生成截止时间待办"]
    },
    outputSummary: `${source}待办已提取`
  };
}

function runVisitorIntakeSkill({ skillId, context }) {
  const raw = [...(context.inputSummary || []), context.skillResults?.[skillId] || ""].join(" ");
  const hasVisitor = raw.includes("访客") || raw.toLowerCase().includes("visitor");
  return {
    result: context.skillResults?.[skillId] || (hasVisitor ? "检测到访客场景" : "未检测到访客"),
    structuredOutput: {
      hasVisitor,
      tasks: hasVisitor ? ["访客登记", "会议室指引", "行政接待提醒"] : [],
      status: hasVisitor ? "已生成接待待办" : "不创建接待流程"
    },
    outputSummary: hasVisitor ? "访客接待流程已预置" : "未触发访客流程"
  };
}

function runWorkSummarySkill({ skillId, context }) {
  const summary = context.skillResults?.[skillId] || "日报摘要已生成";
  return {
    result: summary,
    structuredOutput: {
      summary,
      dimensions: ["完成事项", "延期事项", "协作事项", "下步计划"]
    },
    outputSummary: "日报/周报摘要已生成"
  };
}

function runWorkloadScoreSkill({ skillId, context }) {
  const scoreText = readContextValue(context.outputs, "工作量化分") || "";
  const score = Number(scoreText.match(/\d+/)?.[0] || 0);
  const lowScore = score > 0 && score < 70;
  return {
    result: context.skillResults?.[skillId] || `量化分 ${score || "待计算"}`,
    structuredOutput: {
      score: score || "待计算",
      threshold: 70,
      lowScore,
      reminderTarget: lowScore ? "主管" : "月度总结"
    },
    outputSummary: lowScore ? "工作量低于阈值，已提醒主管确认方向" : "工作量化完成，进入汇总"
  };
}

function readContextValue(lines, label) {
  const prefix = `${label}：`;
  const found = (lines || []).find((line) => String(line).startsWith(prefix));
  return found ? String(found).slice(prefix.length).trim() : "";
}

function attachAutomationEvent(target, event) {
  if (!target || !event) return target;
  target.automationEventId = event.id;
  target.robotName = event.robotName;
  target.skillNames = event.skills.map((item) => item.name);
  target.automationSummary = `${event.businessAction} -> ${event.robotName} -> ${event.skills.length} 个 Skills`;
  return target;
}

function publicAutomationEvent(event) {
  return {
    id: event.id,
    eventType: event.eventType,
    businessAction: event.businessAction,
    robotId: event.robotId,
    robotName: event.robotName,
    actor: event.actor,
    actorRole: event.actorRole,
    objectType: event.objectType,
    objectId: event.objectId,
    taskId: event.taskId,
    inputSummary: event.inputSummary,
    outputTarget: event.outputTarget,
    outputs: event.outputs,
    skills: event.skills,
    status: event.status,
    createdAt: event.createdAt
  };
}

async function readSkillUpload(req) {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await readMultipartForm(req, contentType, 1024 * 1024);
    const file = form.files.find((item) => ["skillFile", "skill", "file"].includes(item.fieldName)) || form.files[0];
    const content = form.fields.content || form.fields.prompt || file?.contentBuffer.toString("utf8") || "";
    return {
      fileName: form.fields.fileName || file?.fileName || "skill-upload.txt",
      content,
      name: form.fields.name,
      purpose: form.fields.purpose,
      inputSchema: form.fields.inputSchema,
      outputSchema: form.fields.outputSchema,
      writesTo: form.fields.writesTo,
      prompt: form.fields.prompt
    };
  }
  if (contentType.includes("text/plain")) {
    const buffer = await readRawBody(req, 1024 * 1024);
    return {
      fileName: "skill-upload.txt",
      content: buffer.toString("utf8")
    };
  }
  const body = await readJson(req);
  return {
    fileName: body.fileName || body.sourceName || "skill-upload.json",
    content: body.content || body.prompt || "",
    name: body.name,
    purpose: body.purpose,
    inputSchema: body.inputSchema,
    outputSchema: body.outputSchema,
    writesTo: body.writesTo,
    prompt: body.prompt
  };
}

function updateSkillDefinition(skillId, user, upload) {
  const current = skillRegistry[skillId];
  if (!current) throw httpError(404, "Skill 不存在");
  const parsed = parseSkillUpload(upload, current);
  skillRegistry[skillId] = {
    ...current,
    ...parsed,
    version: Number(current.version || 1) + 1,
    updatedAt: nowDisplay(),
    updatedBy: user.name,
    sourceName: upload.fileName || parsed.sourceName || "skill-upload"
  };
  return skillRegistry[skillId];
}

function parseSkillUpload(upload, current) {
  const rawContent = String(upload.content || upload.prompt || "").trim();
  let parsed = {};
  if (rawContent) {
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = parseMarkdownSkill(rawContent);
    }
  }
  const prompt = upload.prompt || parsed.prompt || rawContent || current.prompt;
  if (!prompt || prompt.trim().length < 12) throw httpError(400, "上传的 Skill 内容太短，无法替换。");
  return {
    name: upload.name || parsed.name || current.name,
    purpose: upload.purpose || parsed.purpose || current.purpose,
    inputSchema: upload.inputSchema || parsed.inputSchema || current.inputSchema,
    outputSchema: upload.outputSchema || parsed.outputSchema || current.outputSchema,
    writesTo: upload.writesTo || parsed.writesTo || current.writesTo,
    prompt
  };
}

function parseMarkdownSkill(content) {
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const purpose = content.match(/(?:目的|目标|purpose)[:：]\s*(.+)$/im)?.[1]?.trim();
  const inputSchema = content.match(/(?:输入|input)[:：]\s*(.+)$/im)?.[1]?.trim();
  const outputSchema = content.match(/(?:输出|output)[:：]\s*(.+)$/im)?.[1]?.trim();
  const writesTo = content.match(/(?:写回|writesTo)[:：]\s*(.+)$/im)?.[1]?.trim();
  return {
    name: title,
    purpose,
    inputSchema,
    outputSchema,
    writesTo,
    prompt: content
  };
}

function createInvoiceAutofill(user, body) {
  const fileName = body.fileName || "invoice.jpg";
  const inferred = inferInvoiceFields(fileName, body.note || "");
  const formId = nextId("EXP");
  const attachmentName = `${inferred.invoiceDate}_${inferred.merchant}_${inferred.amount}_${inferred.project}.jpg`
    .replace(/[\\/:*?"<>|\s]+/g, "_");
  const fields = {
    applicant: user.name,
    department: user.department,
    expenseType: inferred.expenseType,
    merchant: inferred.merchant,
    invoiceDate: inferred.invoiceDate,
    amount: inferred.amount,
    taxNo: inferred.taxNo,
    project: inferred.project,
    remark: inferred.remark,
    attachmentName
  };
  const form = {
    id: formId,
    system: "AI 工作台",
    template: "报销基础表单",
    status: "已自动回填，待人工确认",
    fields
  };
  const newTask = task(
    nextId("T"),
    `${user.name} 的报销表格已由报销助理自动回填`,
    "expense",
    "finance",
    "财务",
    "need_info",
    "2026-07-08",
    "AI 工作台",
    user.name
  );
  newTask.robotName = "报销助理";
  newTask.skills = ["发票识别与命名", "报销规则校验", "项目费用归类"];
  newTask.invoiceForm = form;
  newTask.result = "发票字段已识别并回填本地报销表格，提交前需人工确认金额和项目归属。";
  const automationEvent = triggerBusinessEvent(user, "invoice.uploaded", {
    objectType: "expense_form",
    objectId: form.id,
    taskId: newTask.id,
    inputSummary: [
      `文件：${fileName}`,
      `项目备注：${body.note || "未填写"}`,
      `发起人：${user.name}`
    ],
    outputs: [
      `报销表单：${form.id}`,
      `商户：${fields.merchant}`,
      `金额：${fields.amount}`,
      `附件命名：${fields.attachmentName}`
    ],
    skillResults: {
      "invoice-ocr": `识别商户 ${fields.merchant}、日期 ${fields.invoiceDate}、金额 ${fields.amount}`,
      "expense-policy-check": "生成提交前人工确认项：金额、项目归属、税号",
      "project-cost-classify": `归类到 ${fields.project}`
    }
  });
  attachAutomationEvent(newTask, automationEvent);
  tasks.unshift(newTask);
  return {
    fields,
    form,
    task: newTask,
    automationEvent: publicAutomationEvent(automationEvent),
    confidence: inferred.confidence,
    message: "报销助理已自动识别发票并回填本地报销表格"
  };
}

function inferInvoiceFields(fileName, note) {
  const text = `${fileName} ${note}`.toLowerCase();
  const amountMatch = `${fileName} ${note}`.match(/(\d+(?:\.\d{1,2})?)/);
  const isDidi = text.includes("didi") || text.includes("滴滴") || text.includes("taxi");
  const isHotel = text.includes("hotel") || text.includes("酒店");
  const isFlight = text.includes("flight") || text.includes("机票") || text.includes("航班");
  const today = todayDate();
  if (isDidi) {
    return {
      expenseType: "交通费",
      merchant: "滴滴出行",
      invoiceDate: today,
      amount: amountMatch ? amountMatch[1] : "68.50",
      taxNo: "待确认",
      project: note.includes("项目") ? note : "客户拜访项目",
      remark: "由报销助理根据发票图片自动识别，提交前请确认。",
      confidence: 0.91
    };
  }
  if (isHotel) {
    return {
      expenseType: "差旅住宿",
      merchant: "酒店供应商",
      invoiceDate: today,
      amount: amountMatch ? amountMatch[1] : "428.00",
      taxNo: "待确认",
      project: "差旅项目",
      remark: "住宿发票已自动识别并归入差旅费用。",
      confidence: 0.86
    };
  }
  if (isFlight) {
    return {
      expenseType: "差旅交通",
      merchant: "航空/票务平台",
      invoiceDate: today,
      amount: amountMatch ? amountMatch[1] : "760.00",
      taxNo: "待确认",
      project: "差旅项目",
      remark: "机票行程单已自动识别并归入差旅交通。",
      confidence: 0.84
    };
  }
  return {
    expenseType: "项目费用",
    merchant: "发票商户待确认",
    invoiceDate: today,
    amount: amountMatch ? amountMatch[1] : "待确认",
    taxNo: "待确认",
    project: note || "待选择项目",
    remark: "已自动回填基础表格，低置信字段需人工确认。",
    confidence: amountMatch ? 0.72 : 0.58
  };
}

function createMeetingWorkflow(user, body) {
  const title = String(body.title || "内部会议").trim();
  const meetingTime = String(body.meetingTime || body.time || "待确认").trim();
  const room = String(body.room || "默认会议室").trim();
  const participants = String(body.participants || "相关同事").trim();
  const purpose = String(body.purpose || body.note || "会议事项").trim();
  const reminder = String(body.reminder || "15分钟前").trim();
  const repeat = String(body.repeat || "不重复").trim();
  const duration = String(body.duration || "1小时").trim();
  const description = String(body.description || "").trim();
  const meeting = {
    id: nextId("MTG"),
    title,
    meetingTime,
    room,
    participants,
    purpose,
    reminder,
    repeat,
    duration,
    description,
    organizer: user.name,
    status: "已预定，已加入我的待办"
  };
  const newTask = task(
    nextId("T"),
    `我的会议预定：${title}`,
    "meeting",
    "ai_workbench",
    user.name,
    "pending",
    todayDate(),
    "AI 工作台",
    user.name
  );
  newTask.meeting = meeting;
  newTask.result = `已预定 ${room} ${meetingTime}，提醒：${reminder}，重复：${repeat}。`;
  const automationEvent = triggerBusinessEvent(user, "meeting.created", {
    objectType: "meeting",
    objectId: meeting.id,
    taskId: newTask.id,
    inputSummary: [
      `主题：${title}`,
      `时间：${meetingTime}`,
      `会议室：${room}`,
      `参会人：${participants}`,
      `提醒：${reminder}`,
      `重复：${repeat}`
    ],
    outputs: [
      `会议记录：${meeting.id}`,
      `我的待办：${newTask.id}`,
      `会议室：${room}`,
      "日程邀请待同步",
      "会后纪要事项已预置"
    ],
    skillResults: {
      "meeting-schedule": `生成会议 ${meeting.id}，预订 ${room}`,
      "minutes-extract": "会后将从纪要中提取结论、负责人和截止时间",
      "visitor-intake": purpose.includes("访客") ? "检测到访客场景，生成接待提醒" : "未检测到访客，不创建接待流程"
    }
  });
  attachAutomationEvent(newTask, automationEvent);
  tasks.unshift(newTask);
  return {
    meeting,
    task: newTask,
    automationEvent: publicAutomationEvent(automationEvent),
    message: "会议已创建，日程和会议助理已自动介入"
  };
}

function createDailyReportWorkflow(user, body) {
  const reportText = String(body.reportText || body.content || "").trim();
  if (reportText.length < 6) throw httpError(400, "日报内容太短，请补充今天完成事项。");
  const reportDate = String(body.reportDate || todayDate()).trim();
  const plan = String(body.plan || body.tomorrow || "明日计划待补充").trim();
  const score = inferWorkloadScore(reportText, plan);
  const deviation = score < 70;
  const report = {
    id: nextId("RPT"),
    reportDate,
    author: user.name,
    summary: summarizeReport(reportText),
    plan,
    workloadScore: score,
    deviation,
    status: deviation ? "需主管确认是否偏离计划" : "已量化，待月度汇总"
  };
  const newTask = task(
    nextId("T"),
    `${user.name} 提交日报：AI 已量化工作量`,
    "daily_report",
    "ai_workbench",
    user.name,
    deviation ? "need_info" : "processing",
    reportDate,
    "AI 工作台",
    user.name
  );
  newTask.report = report;
  newTask.result = `日报已汇总，工作量化分 ${score}。${deviation ? "低于阈值，提醒主管确认是否偏离计划。" : "进入周报/月度汇总。"}`;

  let reminderTask = null;
  if (deviation) {
    reminderTask = task(
      nextId("T"),
      `${user.name} 工作量化低于阈值，请主管确认方向`,
      "work_deviation",
      "hr",
      "主管",
      "pending",
      todayDate(),
      "AI 工作台",
      user.name
    );
    reminderTask.result = `AI 工作量化分 ${score}，请主管判断是计划偏离、资源不足还是任务记录不完整。`;
  }

  const automationEvent = triggerBusinessEvent(user, "daily_report.submitted", {
    objectType: "daily_report",
    objectId: report.id,
    taskId: newTask.id,
    inputSummary: [
      `日期：${reportDate}`,
      `日报长度：${reportText.length}`,
      `明日计划：${plan}`
    ],
    outputs: [
      `日报：${report.id}`,
      `工作量化分：${score}`,
      deviation ? "主管提醒已生成" : "进入周报/月度汇总"
    ],
    skillResults: {
      "work-summary": report.summary,
      "workload-score": `量化分 ${score}，${deviation ? "低于阈值" : "正常"}`,
      "minutes-extract": "从日报文本中提取下步行动和待跟进事项"
    }
  });
  attachAutomationEvent(newTask, automationEvent);
  if (reminderTask) attachAutomationEvent(reminderTask, automationEvent);
  tasks.unshift(newTask);
  if (reminderTask) tasks.unshift(reminderTask);
  return {
    report,
    task: newTask,
    reminderTask,
    automationEvent: publicAutomationEvent(automationEvent),
    message: "日报已提交，日报周报助理已自动量化"
  };
}

function summarizeReport(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 60) return compact;
  return `${compact.slice(0, 60)}...`;
}

function inferWorkloadScore(text, plan) {
  const content = `${text} ${plan}`;
  let score = 76;
  const doneMatches = content.match(/完成|推进|上线|交付|确认|解决|整理|输出|跟进/g);
  if (doneMatches) score += Math.min(doneMatches.length * 4, 18);
  const riskMatches = content.match(/延期|卡住|阻塞|未完成|等待|不确定|偏离|问题/g);
  if (riskMatches) score -= Math.min(riskMatches.length * 8, 28);
  if (content.length > 120) score += 4;
  return Math.max(45, Math.min(96, score));
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
    automationEventId: project.automationEventId || "",
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
  const automationEvent = triggerBusinessEvent(user, "contract.uploaded", {
    objectType: "contract_project",
    objectId: project.id,
    taskId: newTask.id,
    inputSummary: [
      `文件：${project.fileName}`,
      `项目：${project.projectName}`,
      `文本长度：${contractText.length}`
    ],
    outputs: [
      `合同协作项目：${project.id}`,
      "风险备注已生成",
      "产品、财务、法务反馈事项已分派",
      "反馈确认后进入正式审批"
    ],
    skillResults: {
      "contract-intake": `读取合同材料，文本长度 ${contractText.length}`,
      "contract-risk": `生成风险备注：${modelResult.approvalRemark}`,
      "contract-group": "创建业务、产品、财务、法务、AI 五类参与角色",
      "approval-routing": "正式审批链预置为：AI 预审 -> 主管/带教 -> 法务 -> 总助 -> 老板",
      "lifecycle-monitor": "审批后进入归档、交付、账期、担保、KPI 和赔付监控"
    }
  });
  attachAutomationEvent(newTask, automationEvent);
  project.automationEventId = automationEvent.id;
  project.audit.push(`后端事件 ${automationEvent.id} 触发${automationEvent.robotName}`);
  contractProjects.unshift(project);
  tasks.unshift(newTask);
  return {
    project: publicContractProject(project),
    task: newTask,
    analysis: modelResult,
    automationEvent: publicAutomationEvent(automationEvent),
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
  const automationEvent = triggerBusinessEvent(user, "contract.uploaded", {
    objectType: "contract_approval",
    objectId: contract.id,
    taskId: newTask.id,
    inputSummary: [
      `文件：${contract.fileName}`,
      `项目：${contract.project}`,
      `文本长度：${contractText.length}`
    ],
    outputs: [
      `合同审批：${contract.id}`,
      "低/中/高风险已写入审批备注",
      "当前仍按阶段控制可见范围"
    ],
    skillResults: {
      "contract-intake": `读取合同材料，文本长度 ${contractText.length}`,
      "contract-risk": `生成审批备注：${modelResult.approvalRemark}`,
      "contract-group": "直接审批接口不创建项目组，仅保留兼容事件记录",
      "approval-routing": "审批链从 AI 预审开始流转",
      "lifecycle-monitor": "归档后进入后续履约风险监控"
    }
  });
  attachAutomationEvent(newTask, automationEvent);
  contract.automationEventId = automationEvent.id;
  contract.audit.push(`后端事件 ${automationEvent.id} 触发${automationEvent.robotName}`);
  contracts.unshift(contract);
  tasks.unshift(newTask);
  return { contract, task: newTask, analysis: modelResult, automationEvent: publicAutomationEvent(automationEvent), message: "合同已进入 AI 预审，老板暂不可见" };
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
  if (["meeting"].includes(type)) return "日程和会议助理";
  if (["daily_report"].includes(type)) return "日报周报助理";
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
    daily_report: "staff",
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

function canViewAutomationGovernance(user) {
  return ["boss", "assistant"].includes(user.role);
}

function canSeeAutomationEvent(user, event) {
  if (canViewAutomationGovernance(user)) return true;
  return event.actor === user.name || event.actor === user.username;
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

async function readInvoiceSubmission(req) {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    const result = await readMultipartContract(req, contentType);
    return {
      fileName: result.fileName || "invoice.jpg",
      fileBuffer: result.fileBuffer,
      note: result.note || result.project || result.contractText || ""
    };
  }
  const body = await readJson(req);
  return {
    fileName: body.fileName || "invoice.jpg",
    note: body.note || body.project || ""
  };
}

async function readMultipartForm(req, contentType, maxBytes = 8 * 1024 * 1024) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw httpError(400, "上传格式错误：缺少 multipart boundary");
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const raw = await readRawBody(req, maxBytes);
  const parts = raw.toString("binary").split(`--${boundary}`);
  const fields = {};
  const files = [];

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
      files.push({ fieldName: name, fileName, contentBuffer });
    } else {
      fields[name] = contentBuffer.toString("utf8").trim();
    }
  }

  return { fields, files };
}

async function readMultipartContract(req, contentType) {
  const form = await readMultipartForm(req, contentType);
  const fields = form.fields;
  const uploadedFile = form.files.find((item) => ["contractFile", "invoiceFile", "file"].includes(item.fieldName)) || form.files[0];
  const contractText = fields.contractText || "";
  const fileName = fields.fileName || uploadedFile?.fileName || "contract.txt";
  return {
    title: fields.title || "客户合同审批",
    project: fields.project || "未关联项目",
    amount: fields.amount || "待识别",
    note: fields.note || "",
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

function nowDisplay() {
  const value = new Date();
  const pad = (input) => String(input).padStart(2, "0");
  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}:${pad(value.getMinutes())}`
  ].join(" ");
}

function todayDate() {
  const value = new Date();
  const pad = (input) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
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
