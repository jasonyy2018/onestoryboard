/**
 * 题材检测（仅本地逻辑）：用于选择感染体特效妆模板等。
 * 不向 API 输出本文件中的字面；出站文本请使用 safety.scrubForExternalImageApi。
 */
export function textSuggestsUndeadOrSfxMakeup(text: string): boolean {
  return /丧尸|僵尸|行尸|尸变|活死人|腐尸|尸化|吸血鬼|不死族|僵屍|尸斑|undead|zombie|walking\s*dead|vampire|ghoul|reanimated/i.test(
    text,
  );
}
