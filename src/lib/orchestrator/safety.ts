/**
 * Safety and Compliance Utility
 * - 本地：SENSITIVE_MAP / filterSensitiveWords 仅用于匹配用户侧文本并替换。
 * - 出站：scrubForExternalImageApi 在发往生图等外部 API 前再做一层中性化（默认模板本身不含敏感字面）。
 */

import { projectLocale } from "@/lib/i18n/project-ui";

export const GLOBAL_NEGATIVE_PROMPT = [
  "low quality",
  "blurry",
  "distorted",
  "deformed",
  "mutated",
  "extra limbs",
  "bad anatomy",
  "anime",
  "cartoon",
  "3d render",
  "video game",
  "cgi",
  "cluttered composition",
  "off-model extras",
  "non-diegetic UI",
  "watermark",
  "subtitles",
  "shaky camera",
  "bad lighting",
].join(", ");

const GLOBAL_NEGATIVE_ZH = [
  "低画质",
  "模糊",
  "畸形",
  "肢体畸变",
  "多余肢体",
  "结构错位",
  "动漫",
  "卡通",
  "三渲二",
  "游戏画面",
  "廉价 CGI",
  "构图杂乱",
  "乱入界面元素",
  "水印",
  "字幕条",
  "剧烈晃镜",
  "脏乱灯光",
].join("，");

export const USER_STRICT_BANS = [
  "Keep character look aligned with reference plates",
  "Avoid unrelated props or extras in frame",
  "Avoid impossible joint angles",
  "Avoid obviously broken facial geometry",
  "Avoid non-photographic stylization",
].join(". ");

const USER_STRICT_BANS_ZH = [
  "角色外观与参考图保持一致",
  "镜头内不出现与剧本无关的道具或人物",
  "避免明显不合理的关节角度",
  "避免明显崩坏的五官比例",
  "避免非实拍类画面质感",
].join("。");

/** 仅用于本地匹配用户/模型原文；替换串一律中性，不写入对外的固定模板。 */
const SENSITIVE_MAP: [RegExp, string][] = [
  [/血[腥腥]?|杀人|屠杀|残肢/g, "冲突戏份"],
  [/枪[支支]?|武器|炸弹/g, "装备"],
  [/裸[露露]?|色情|猥亵|床戏/g, "相关描写"],
  [/胸[部部]?|臀[部部]?|私处/g, "形体线条"],
  [/政府|国家|领导人/g, "机构"],
  [/赌博|毒品|犯罪/g, "博弈"],
];

export function filterSensitiveWords(text: string): string {
  let filtered = text;
  for (const [pattern, replacement] of SENSITIVE_MAP) {
    filtered = filtered.replace(pattern, replacement);
  }
  return filtered;
}

/**
 * 发往外部生图 API 前的最后一道中性化（与模型商无关的措辞）。
 * 应先对剧本文本走 filterSensitiveWords，再对本函数输出送模型。
 */
export function scrubForExternalImageApi(text: string, lang: "zh" | "en"): string {
  const base = filterSensitiveWords(text);
  if (lang === "zh") {
    return base
      .replace(/OL女/g, "通勤着装女性")
      .replace(/OL/g, "通勤职业装")
      .replace(/女丧尸/g, "女性感染体特效妆角色")
      .replace(/丧尸/g, "感染体特效妆")
      .replace(/僵尸/g, "行走类特效妆")
      .replace(/尸变|腐尸|屠杀|残肢/g, "戏剧化动作")
      .replace(/血腥|内脏|断肢|残杀/g, "戏剧冲突")
      .replace(/裸露|露骨|色情|猥亵|床戏|性暗示/g, "不宜展示的细节描写")
      .replace(/创口|尸斑|腐烂/g, "妆效层次");
  }
  return base
    // violence
    .replace(/\bzombies?\b/gi, "infected-type sfx-makeup character")
    .replace(/\bwalking dead\b/gi, "infected sfx-makeup character")
    .replace(/\b(gore|gory|dismember|entrails)\b/gi, "stylized action")
    .replace(/\b(blood(?:y|shed|bath|thirsty)?|massacre|carnage)\b/gi, "conflict scene")
    .replace(/\bkill(?:ing|er)?s?\b/gi, "conflict action")
    .replace(/\b(wound(?:s|ed)?|corpse(?:s)?|rott(?:en|ing)|decay(?:ing)?)\b/gi, "sfx makeup layer")
    // weapons
    .replace(/\b(weapon(?:s)?|gun(?:s)?|bomb(?:s)?|ammunition)\b/gi, "equipment")
    // sexual / body
    .replace(/\b(nudity|naked|porn(?:ographic)?|obscene|intercourse|sexually?\s+explicit)\b/gi, "non-explicit description")
    .replace(/\b(breasts?|buttocks?|genitals?|genitalia)\b/gi, "body silhouette")
    // clothing
    .replace(/\bOL\b/g, "business-casual wardrobe")
    // political
    .replace(/\b(government|president)\b/gi, "authority")
    // crime / drugs
    .replace(/\b(gambling|drugs?|crime|criminal)\b/gi, "illegal activity");
}

/**
 * 出站负面提示再收一道，去掉仍可能被误扫的组合词（仅中性输出）。
 */
export function scrubNegativeForExternalImageApi(text: string, lang: "zh" | "en"): string {
  const base = filterSensitiveWords(text);
  if (lang === "zh") {
    return base
      .replace(/裸露性器官|性器官|色情|猥亵|床戏|性暗示/g, "非审定杂质")
      .replace(/血腥|断肢|屠杀|残杀|内脏|法医纪实|低俗|不雅/g, "画面杂质")
      .replace(/过激画面特写|不当低俗质感|写实冲突纪实风格/g, "非档案级质感");
  }
  return base
    .replace(/\b(nudity|naked|porn(?:ographic)?|obscene|intercourse)\b/gi, "non-broadcast framing")
    .replace(/\bsexual(?:ly)?\s+content\b/gi, "non-broadcast tone")
    .replace(/\b(gore|gory|dismember(?:ment)?|entrails?)\b/gi, "non-broadcast shock")
    .replace(/\b(kill(?:ing|er)?s?|massacre|carnage|blood(?:y|shed|bath)?|wound(?:s|ed)?)\b/gi, "non-broadcast violence")
    .replace(/\bexplicit\b/gi, "non-broadcast framing");
}

/**
 * Enforces the "Industrial Pipeline" style constraints.
 * @param lang 项目语言 zh / en，控制负面提示与包装句式语言。
 */
export function wrapCinematicPrompt(prompt: string, lang?: string | null): string {
  const safetyFiltered = scrubForExternalImageApi(filterSensitiveWords(prompt), projectLocale(lang) === "en" ? "en" : "zh");
  const loc = projectLocale(lang);
  if (loc === "en") {
    return `(Film-grade realistic cinematography, high fidelity, 8k, professional lighting). ${safetyFiltered}. (Negative: ${GLOBAL_NEGATIVE_PROMPT}). ${USER_STRICT_BANS}.`;
  }
  return `（电影级写实摄影，高细节，8K，专业布光。）${safetyFiltered}（负面：${GLOBAL_NEGATIVE_ZH}。${USER_STRICT_BANS_ZH}）`;
}
