# 出口易 AI 工作台 Demo

企业内部统一工作台 Demo，用于演示：

- 企微常用能力迁移到统一工作台
- 组织架构驱动权限与数据可见范围
- 不同角色看到不同岗位入口
- 审批中心内嵌合同审批与 AI 风险备注
- 员工提交后由后端控制审批阶段和待办可见性

## 本地打开

静态展示可直接用浏览器打开 `index.html`。

需要演示真实提交链路时运行：

```bash
node server.js
```

然后打开：

```text
http://localhost:3000
```

## 合同审批链路

员工提交合同后不会第一时间进入老板待办。后端状态机为：

```text
员工提交 -> 合同审批助理 AI 预审 -> 带教/主管审核 -> 法务审核 -> 总助复核 -> 老板终审 -> 归档/抄送
```

可见性规则：

- `submitted` / `ai_review`：老板不可见，仅发起人与后端流程处理。
- `mentor_review`：带教/主管可见，老板不可见。
- `legal_review`：法务可见，法务审核通过后才进入总助复核。
- `assistant_review`：总助可见，老板不可见。
- `boss_review`：前置审核完成后，老板才看到终审待办。
- `archived`：归档后按授权汇总展示。

主要接口：

- `POST /api/auth/login`
- `GET /api/tasks`
- `POST /api/approvals/contracts`
- `POST /api/approvals/contracts/:id/advance`
- `POST /api/skills/:skillId/run`

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
