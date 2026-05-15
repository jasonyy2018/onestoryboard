/**
 * 将所有角色资产从旧 project（default）迁移到当前配置的 project（workflow-test）。
 *
 * 运行方式（在服务器容器内）：
 *   docker compose exec app node_modules/.bin/tsx scripts/migrate-assets-to-project.ts
 *
 * 或在宿主机上：
 *   cd ~/dockerdata/onestoryboard
 *   docker compose exec app node_modules/.bin/tsx scripts/migrate-assets-to-project.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

const SERVICE = "ark";
const REGION = "cn-beijing";
const VERSION = "2024-01-01";
const HOST = "open.volcengineapi.com";

const ak = process.env.VOLCENGINE_ACCESS_KEY_ID;
const sk = process.env.VOLCENGINE_SECRET_ACCESS_KEY;
const projectName = process.env.VOLCENGINE_PROJECT_NAME || "default";

if (!ak || !sk) {
  console.error("VOLCENGINE_ACCESS_KEY_ID / VOLCENGINE_SECRET_ACCESS_KEY not set");
  process.exit(1);
}

console.log(`Target project: ${projectName}`);

function sign(method: string, path: string, query: Record<string, string>, headers: Record<string, string>, body: string, now: Date) {
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const he = Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.trim()]).sort(([a = ""], [b = ""]) => a < b ? -1 : 1);
  const ch = he.map(([k, v]) => `${k}:${v}`).join("\n") + "\n";
  const sh = he.map(([k]) => k).join(";");
  const cq = Object.entries(query).sort().map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const ph = crypto.createHash("sha256").update(body).digest("hex");
  const cr = [method, path, cq, ch, sh, ph].join("\n");
  const sts = ["HMAC-SHA256", amzDate, `${dateStamp}/${REGION}/${SERVICE}/request`, crypto.createHash("sha256").update(cr).digest("hex")].join("\n");
  const kD = crypto.createHmac("sha256", sk!).update(dateStamp).digest();
  const kR = crypto.createHmac("sha256", kD).update(REGION).digest();
  const kS = crypto.createHmac("sha256", kR).update(SERVICE).digest();
  const kSi = crypto.createHmac("sha256", kS).update("request").digest();
  const sig = crypto.createHmac("sha256", kSi).update(sts).digest("hex");
  return `HMAC-SHA256 Credential=${ak}/${dateStamp}/${REGION}/${SERVICE}/request, SignedHeaders=${sh}, Signature=${sig}`;
}

async function volcCall(action: string, body: Record<string, unknown>) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const payload = JSON.stringify(body);
  const ph = crypto.createHash("sha256").update(payload).digest("hex");
  const headers: Record<string, string> = { "Content-Type": "application/json", "Host": HOST, "X-Date": amzDate, "X-Content-Sha256": ph };
  const auth = sign("POST", "/", { Action: action, Version: VERSION }, headers, payload, now);
  const res = await fetch(`https://${HOST}/?Action=${action}&Version=${VERSION}`, {
    method: "POST", headers: { ...headers, authorization: auth }, body: payload,
  });
  return res.json() as Promise<any>;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function getOrCreateGroup(projectId: string, title: string): Promise<string> {
  // 查数据库里是否已有 workflow-test 下的 groupId
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });

  // 检查现有 groupId 是否在目标 project 里
  if (project.volcengineAssetGroupId) {
    const r = await volcCall("GetAssetGroup", { Id: project.volcengineAssetGroupId, ProjectName: projectName });
    if (!r.ResponseMetadata?.Error && r.Result?.Id) {
      return project.volcengineAssetGroupId;
    }
  }

  // 创建新 group
  const r = await volcCall("CreateAssetGroup", { Name: `${title}_assets`, GroupType: "AIGC", ProjectName: projectName });
  if (r.ResponseMetadata?.Error) throw new Error(`CreateAssetGroup failed: ${JSON.stringify(r.ResponseMetadata.Error)}`);
  const groupId = r.Result.Id;
  await db.project.update({ where: { id: projectId }, data: { volcengineAssetGroupId: groupId } });
  console.log(`  Created new group ${groupId} in ${projectName}`);
  return groupId;
}

async function ingestAsset(groupId: string, url: string, name: string): Promise<string> {
  const r = await volcCall("CreateAsset", { GroupId: groupId, URL: url, AssetType: "Image", Name: name, ProjectName: projectName });
  if (r.ResponseMetadata?.Error) throw new Error(`CreateAsset failed: ${JSON.stringify(r.ResponseMetadata.Error)}`);
  const assetId = r.Result.Id;

  // 轮询直到 Active
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const s = await volcCall("GetAsset", { Id: assetId, ProjectName: projectName });
    if (s.ResponseMetadata?.Error) throw new Error(`GetAsset failed: ${JSON.stringify(s.ResponseMetadata.Error)}`);
    const status = s.Result?.Status;
    if (status === "Active") return assetId;
    if (status === "Failed") throw new Error(`Asset ${assetId} ingestion failed`);
  }
  throw new Error(`Asset ${assetId} timed out`);
}

async function main() {
  // 找所有有 refImageUrl 但 volcengineAssetId 不在 workflow-test 的角色
  const characters = await db.character.findMany({
    where: { refImageUrl: { not: null } },
    include: { project: { select: { id: true, title: true } } },
    orderBy: { project: { title: "asc" } },
  });

  console.log(`Found ${characters.length} characters with refImageUrl`);

  // 验证哪些角色的 assetId 在目标 project 里有效
  const toMigrate: typeof characters = [];
  for (const c of characters) {
    if (!c.volcengineAssetId) {
      toMigrate.push(c);
      continue;
    }
    const r = await volcCall("GetAsset", { Id: c.volcengineAssetId, ProjectName: projectName });
    if (r.ResponseMetadata?.Error || r.Result?.Status !== "Active") {
      console.log(`  ${c.name} (${c.project.title}): asset ${c.volcengineAssetId} not in ${projectName} → will migrate`);
      toMigrate.push(c);
    } else {
      console.log(`  ${c.name} (${c.project.title}): ✓ already Active in ${projectName}`);
    }
  }

  console.log(`\n${toMigrate.length} characters to migrate\n`);

  // 按 project 分组，批量入库
  const byProject = new Map<string, typeof characters>();
  for (const c of toMigrate) {
    const pid = c.projectId;
    if (!byProject.has(pid)) byProject.set(pid, []);
    byProject.get(pid)!.push(c);
  }

  for (const [projectId, chars] of byProject) {
    const title = chars[0].project.title;
    console.log(`\nProject: ${title}`);
    const groupId = await getOrCreateGroup(projectId, title);

    for (const c of chars) {
      try {
        console.log(`  Migrating ${c.name}...`);
        const newAssetId = await ingestAsset(groupId, c.refImageUrl!, c.name);
        await db.character.update({
          where: { id: c.id },
          data: { volcengineAssetId: newAssetId, volcengineStatus: "Active" },
        });
        console.log(`  ✓ ${c.name} → ${newAssetId}`);
      } catch (err) {
        console.error(`  ✗ ${c.name}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log("\nMigration complete.");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
