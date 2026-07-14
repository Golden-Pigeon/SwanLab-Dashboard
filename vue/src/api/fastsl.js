/**
 * fastsl 专属 api：实验别名、对比分组。
 * 这些端点在 swanboard 契约之外（统一挂 /api/v1/fastsl/*），仅写入侧车文件，不改动训练日志。
 */
import http from './http'

export const fastsl = {
  /** 拉取别名 + 分组（启动时一次） */
  getUI: () => http.get('/fastsl/ui'),
  /** 设置/清除实验别名（空串清除，恢复原始名称） */
  setAlias: (runId, alias) => http.patch(`/fastsl/experiment/${encodeURIComponent(runId)}/alias`, { alias }),
  /** 新建分组，可带初始成员（run_id 列表） */
  createGroup: (name, members = []) => http.post('/fastsl/group', { name, members }),
  /** 分组改名 */
  renameGroup: (gid, name) => http.patch(`/fastsl/group/${gid}`, { name }),
  /** 删除分组 */
  deleteGroup: (gid) => http.delete(`/fastsl/group/${gid}`),
  /** 向分组添加成员 */
  addMember: (gid, runId) => http.post(`/fastsl/group/${gid}/member`, { run_id: runId }),
  /** 从分组移除成员 */
  removeMember: (gid, runId) => http.delete(`/fastsl/group/${gid}/member/${encodeURIComponent(runId)}`),
  /** 分组对比图表（形状同 /project/charts，仅组内实验） */
  getGroupCharts: (gid) => http.get(`/fastsl/group/${gid}/charts`)
}
