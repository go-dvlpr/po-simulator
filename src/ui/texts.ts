import { criterionDef } from '../data/research.ts';
import { channelDef, segmentDef } from '../engine/catalog.ts';
import type { Hypothesis, ScenarioDef } from '../engine/types.ts';
import { fixed, money } from '../format.ts';
import { t } from '../i18n/index.ts';

export function hypothesisStatement(sc: ScenarioDef, h: Hypothesis): string {
  const seg = segmentDef(sc, h.segmentId).name;
  switch (h.kind) {
    case 'problem':
      return t('У сегмента «{0}» есть острая проблема, которую решает наш продукт.', [seg]);
    case 'wtp':
      return t('Сегмент «{0}» готов платить {1}{2}.', [seg, money(h.price ?? 0), sc.labels.priceUnit]);
    case 'channel':
      return t('Сегмент «{0}» можно выгодно привлекать через «{1}».', [seg, h.channelId ? channelDef(sc, h.channelId).name : '—']);
    case 'solution':
      return t('Наше решение настолько полезно для сегмента «{0}», что им будут пользоваться регулярно.', [seg]);
  }
}

export function criterionText(h: Pick<Hypothesis, 'criterionId' | 'threshold'>): string {
  const c = criterionDef(h.criterionId);
  return c.template.replace('{t}', fixed(h.threshold, h.threshold % 1 ? 1 : 0));
}

export function observedText(h: Hypothesis): string {
  if (h.observed === undefined) return '';
  const c = criterionDef(h.criterionId);
  if (c.unit === '$') return t('факт: {0}', [money(h.observed)]);
  if (c.unit === '%') return t('факт: {0}%', [fixed(h.observed, 1)]);
  if (c.id === 'c_expert') return t('оценка экспертов: {0} из 100', [fixed(h.observed, 0)]);
  return t('факт: да');
}

export const STATUS_TEXT: Record<Hypothesis['status'], string> = {
  untested: t('Не проверена'),
  supported: t('Подтверждена'),
  refuted: t('Опровергнута'),
};
