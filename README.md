# 出口易 AI 工作台 Demo

企业内部统一工作台 Demo，用于演示：

- 企微常用能力迁移到统一工作台
- 组织架构驱动权限与数据可见范围
- 不同角色看到不同岗位入口
- 老板/总助可查看机器人与 Skills 编排
- 审批中心内嵌合同协作项目与 AI 风险备注
- 合同先创建项目组沉淀反馈，再自动发起正式审批
- 审批完成后进入合同档案、交付和履约风险监控

## 本地打开

静态展示可直接用浏览器打开 `index.html`。

需要演示真实提交链路时运行：

```bash
npm install
node server.js
```

然后打开：

```text
http://localhost:3000
```

## 合同协作项目链路

合同不是一上传就审批。员工或主管提交合同/邮件材料后，系统先创建合同协作项目：

```text
提交合同/沟通材料
-> AI 读取合同与附件
-> 自动创建合同项目组
-> 产品/财务/法务/业务反馈沉淀
-> 反馈确认后自动发起正式审批
-> 审批通过后进入合同档案、交付管理、履约风险监控
```

正式审批状态机为：

```text
带教/主管审核 -> 法务审核 -> 总助复核 -> 老板终审 -> 归档/抄送
```

可见性规则：

- 合同协作项目：发起人、主管、财务、法务、总助、老板按角色看到项目组信息与风险摘要。
- 正式审批创建前：老板没有“上传合同/发起合同”的入口。
- `mentor_review`：带教/主管可见，老板不可见。
- `legal_review`：法务可见，法务审核通过后才进入总助复核。
- `assistant_review`：总助可见，老板不可见。
- `boss_review`：前置审核完成后，老板才看到终审待办。
- `archived`：归档后按授权汇总展示。

主要接口：

- `POST /api/auth/login`
- `GET /api/tasks`
- `POST /api/contracts/projects`
- `POST /api/contracts/projects/:id/start-approval`
- `POST /api/approvals/contracts`
- `POST /api/approvals/contracts/:id/advance`

## 合同模型分析

合同项目创建不是前端默认写死风险备注。后端会：

```text
上传 PDF/DOCX/TXT 或粘贴合同/邮件摘要
-> 提取合同正文或沟通材料
-> 调用模型
-> 返回 highRisks / mediumRisks / lowRisks
-> 写入合同项目组风险备注
-> 创建部门反馈与后续正式审批入口
```

运行前配置模型环境变量。仓库提供 `.env.example`，真实 `.env` 已被 `.gitignore` 忽略，不会提交到 GitHub：

```env
MODEL_PROVIDER_NAME=美团模型
MODEL_API_URL=https://api.longcat.chat/openai/v1
MODEL_API_KEY=你的模型密钥
MODEL_NAME=LongCat-2.0
```

接口支持 `multipart/form-data` 文件上传，也支持 JSON：

```json
{
  "title": "客户合同协作项目",
  "fileName": "contract.txt",
  "contractText": "合同正文或沟通摘要..."
}
```

未完整配置模型参数时，后端会返回 `503 模型未配置完整`，不会伪造低/中/高风险结果。

## 机器人与 Skills

Demo 已内置 11 个机器人/数字员工的 Skills 编排：

- 报销助理
- 差旅外勤助理
- 日报周报助理
- 生意分析助理
- 日程和会议助理
- 访客教练
- 产品培训教练
- 系统培训教练
- AI教练
- 报价助理
- 合同审批助理

普通员工只看到业务入口，不直接看到后台 Skills。机器人由业务动作自动触发，例如上传发票图片后自动识别并回填本地报销表格，提交前由员工确认；上传合同材料后自动创建合同协作项目。基础版先不做企微回填，后续再对接企微、财务、人事、项目、合同系统。老板和总助账号可以进入“机器人编排”查看每个机器人调用哪些 Skills、输入输出是什么、写回哪个系统。

详细矩阵见：`docs/robot-skills-matrix.md`

## Demo 账号

所有账号密码均为 `123456`：

- `boss`
- `manager`
- `manger`
- `employee`
- `hr`
- `finance`
- `legal`
- `assistant`
