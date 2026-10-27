import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOptionalGame } from '../context.ts';
import type { GlossaryId } from '../glossary.ts';
import { GLOSSARY } from '../glossary.ts';
import { t } from '../../i18n/index.ts';

const WIDTH = 300;

interface Position {
  top: number;
  left: number;
  below: boolean;
}

// A "?" mark that explains a term on hover, focus or tap. The text comes from the
// glossary (`term`) or from props; `text` overrides the glossary text but keeps its title and article.
export function Hint(props: { term?: GlossaryId; title?: ReactNode; text?: ReactNode; article?: string }) {
  const entry = props.term ? GLOSSARY[props.term] : undefined;
  const title = props.title ?? entry?.title;
  const text = props.text ?? entry?.text;
  const article = props.article ?? entry?.article;
  const game = useOptionalGame();
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<Position | null>(null);
  const [pinned, setPinned] = useState(false);

  const open = () => {
    window.clearTimeout(closeTimer.current);
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.top < 220;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8);
    setPos({ top: below ? r.bottom + 8 : r.top - 8, left, below });
  };
  const close = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setPos(null);
      setPinned(false);
    }, 120);
  };
  const toggle = () => {
    if (pinned) {
      setPinned(false);
      setPos(null);
    } else {
      open();
      setPinned(true);
    }
  };

  useEffect(() => {
    if (!pos) return undefined;
    const hide = () => {
      setPos(null);
      setPinned(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        hide();
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!anchor.current?.contains(target) && !document.getElementById(id)?.contains(target)) hide();
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [pos, id]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  if (!text) return null;
  const label = typeof title === 'string' ? t('Что такое «{0}»?', [title]) : t('Подсказка');

  return (
    <>
      <span
        ref={anchor}
        role="button"
        tabIndex={0}
        className={`hint ${pos ? 'open' : ''}`}
        aria-label={label}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={() => !pinned && close()}
        onFocus={open}
        onBlur={() => !pinned && close()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }
        }}
      >
        ?
      </span>
      {pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className={`hint-pop ${pos.below ? 'below' : 'above'}`}
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            onMouseEnter={() => window.clearTimeout(closeTimer.current)}
            onMouseLeave={() => !pinned && close()}
          >
            {title && <div className="hint-title">{title}</div>}
            <div className="hint-text">{text}</div>
            {article && game && (
              <button
                type="button"
                className="hint-more"
                onClick={() => {
                  setPos(null);
                  setPinned(false);
                  game.openArticle(article);
                }}
              >
                {t('Подробнее в справочнике →')}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

// A term inside a sentence: the text stays readable, the "?" explains it.
export function Term(props: { id: GlossaryId; children?: ReactNode }) {
  return (
    <span className="term">
      {props.children ?? GLOSSARY[props.id].title}
      <Hint term={props.id} />
    </span>
  );
}
