const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const port = Number(process.env.PORT || 3000);
const publicDir = __dirname;
const sessions = new Map();

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
  "assistant_review",
  "boss_review",
  "archived"
];

let contracts = [];
let tasks = [
  task("T-1001", "校园招聘项目立项与角色分工", "project", "project", "主管", "processing", "2026-07-08", "项目系统", "系统"),
  task("T-1002", "员工试用期转正评估", "probation", "hr", "主管", "pending", "2026-07-05", "人事系统", "系统"),
  task("T-1006", "员工月度工作量化低于阈值，请确认是否偏离计划", "work_deviation", "hr", "主管", "pending", "2026-07-06", "AI 工作台", "系统"),
  task("T-1007", "员工从销售支持组转入产品组，需完成权限交接", "org_change", "hr", "总助", "pending", "2026-07-06", "组织权限", "系统"),
  task("T-1003", "滴滴发票报销归入校园招聘项目", "expense", "finance", "财务", "need_info", "2026-07-03", "财务系统", "系统"),
  contractTask("T-1004", "客户合同已完成 AI 预审，待带教/主管审核", "主管", "pending", "2026-07-04", "mentor_review", "员工", "AI 已写入低/中/高风险备注，暂不进入老板待办。"),
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

  if (req.method === "POST" && url.pathname === "/api/approvals/contracts") {
    const body = await readJson(req);
    const payload = createContractApproval(user, body);
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

  const skillMatch = url.pathname.match(/^\/api\/skills\/([^/]+)\/run$/);
  if (req.method === "POST" && skillMatch) {
    const body = await readJson(req);
    const result = runSkill(user, decodeURIComponent(skillMatch[1]), body);
    sendJson(res, 201, result);
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

function createContractApproval(user, body) {
  const contract = {
    id: nextId("C"),
    title: body.title || "客户合同审批",
    fileName: body.fileName || "合同文件.pdf",
    project: body.project || "未关联项目",
    amount: body.amount || "待识别",
    initiator: user.name,
    approvalStage: "ai_review",
    riskNotes: [
      { level: "低", text: "主体、金额、签署信息完整。" },
      { level: "中", text: "付款节点与验收标准偏宽，需带教/主管确认交付口径。" },
      { level: "高", text: "违约责任上限未明确，进入人工审核前需补充责任边界。" }
    ],
    audit: [
      `${user.name} 提交合同`,
      "合同审批助理进入 AI 预审"
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
      "合同已提交后端，当前仅发起人可见；老板暂不可见。"
    ),
    contractId: contract.id
  };
  contracts.unshift(contract);
  tasks.unshift(newTask);
  return { contract, task: newTask, message: "合同已进入 AI 预审，老板暂不可见" };
}

function advanceContract(user, contractId) {
  const contract = contracts.find((item) => item.id === contractId);
  const relatedTask = tasks.find((item) => item.contractId === contractId);
  if (!contract || !relatedTask) throw httpError(404, "合同不存在");

  const currentIndex = contractStages.indexOf(contract.approvalStage);
  const currentStage = contract.approvalStage;
  if (currentStage === "mentor_review" && user.role !== "manager") throw httpError(403, "需带教/主管审核");
  if (currentStage === "assistant_review" && user.role !== "assistant") throw httpError(403, "需总助复核");
  if (currentStage === "boss_review" && user.role !== "boss") throw httpError(403, "需老板终审");

  const nextStage = contractStages[Math.min(currentIndex + 1, contractStages.length - 1)];
  const nextOwner = {
    mentor_review: "主管",
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
    ? "前置审核已完成，进入老板终审待办。"
    : "审批阶段已更新。";

  return { contract, task: relatedTask };
}

function runSkill(user, skillId, body) {
  if (skillId === "contract-approval-assistant") {
    return createContractApproval(user, {
      title: "合同审批助理提交的客户合同",
      fileName: "skill_contract_demo.pdf",
      project: "销售合同",
      amount: "AI 待识别",
      input: body.input
    });
  }

  const map = {
    "expense-assistant": ["报销助理已生成报销草稿，待本人确认", "expense", "finance", "财务", "财务系统"],
    "travel-field-assistant": ["差旅外勤助理已生成外勤/出差申请，待主管审批", "travel", "wecom", "主管", "企微审批"],
    "weekly-report-assistant": ["日报周报助理已生成周报草稿，待主管确认", "todo", "ai_workbench", "主管", "AI 工作台"],
    "meeting-schedule-assistant": ["日程和会议助理已生成会议预订草稿", "meeting", "wecom", "主管", "企微日程"],
    "product-training-coach": ["产品培训教练已写入学习记录", "todo", "ai_workbench", "主管", "培训知识库"],
    "system-training-coach": ["系统培训教练已写入培训完成记录", "todo", "ai_workbench", "主管", "培训知识库"],
    "quote-assistant": ["报价助理已生成报价草案，待销售主管确认", "todo", "ai_workbench", "主管", "报价系统"]
  };
  const item = map[skillId] || ["Skill 已运行，待人工确认", "todo", "ai_workbench", "主管", "AI 工作台"];
  const newTask = task(nextId("T"), item[0], item[1], item[2], item[3], "pending", "2026-07-08", item[4], user.name);
  newTask.result = "后端已接收 Skill 输入，正式版接入 Dify/扣子/业务系统后写回原系统。";
  tasks.unshift(newTask);
  return { task: newTask, input: body.input || "" };
}

function titleForContractStage(initiator, stage) {
  return {
    ai_review: `${initiator} 发起：合同审批（AI 预审中）`,
    mentor_review: `${initiator} 发起：合同审批待带教/主管审核`,
    assistant_review: `${initiator} 发起：合同审批待总助复核`,
    boss_review: `${initiator} 发起：合同审批待老板终审`,
    archived: `${initiator} 发起：合同审批已归档`
  }[stage] || `${initiator} 发起：合同审批`;
}

function ownerFor(type) {
  if (["expense", "expense_review", "invoice", "payment", "cost", "project_cost"].includes(type)) return "财务";
  if (["org_change", "handover"].includes(type)) return "总助";
  if (["onboard", "probation", "transfer", "resign", "hr_file"].includes(type)) return "HR";
  if (["contract"].includes(type)) return "合同审批助理";
  if (["recruiting"].includes(type)) return "HR";
  return "主管";
}

function canSeeTask(user, item) {
  if (!item) return false;
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
  if (item.approvalStage === "assistant_review") return user.role === "assistant";
  if (item.approvalStage === "boss_review") return ["boss", "assistant"].includes(user.role);
  if (item.approvalStage === "archived") return ["boss", "assistant", "manager", "legal"].includes(user.role);
  return false;
}

function requireUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const username = sessions.get(token);
  if (!username || !accounts[username]) throw httpError(401, "请先登录");
  return publicAccount(accounts[username], username);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(httpError(413, "请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(httpError(400, "JSON 格式错误"));
      }
    });
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
