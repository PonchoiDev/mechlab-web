import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

// Retardo al cambiar o cerrar un submenú con el ratón, para poder llegar a él en diagonal.
const SUBMENU_DELAY_MS = 250;

export interface MenuOption {
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

export type MenuEntry =
  | { kind: 'action'; label: string; hint?: string; disabled?: boolean; danger?: boolean; confirm?: string; onSelect: () => void }
  | { kind: 'submenu'; label: string; hint?: string; disabled?: boolean; entries: MenuEntry[] }
  | { kind: 'options'; label: string; hint?: string; options: MenuOption[] }
  | { kind: 'section'; label: string };

type ActionEntry = Extract<MenuEntry, { kind: 'action' }>;

interface ContextMenuProps {
  x: number;
  y: number;
  title: string;
  entries: MenuEntry[];
  onClose: () => void;
}

const ITEM_SELECTOR = ':scope > li > [data-menuitem], :scope > li > .context-menu-options > [data-menuitem]';

const focusables = (list: HTMLElement | null) =>
  list ? Array.from(list.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR)).filter(item => !item.disabled) : [];

const MARGIN = 8;

// Coloca el menú dentro de la ventana. Los submenús usan posición fija junto a su fila para que
// el scroll del menú padre no los recorte; si no caben a la derecha, se abren a la izquierda.
const placeMenu = (element: HTMLElement | null, anchor?: { x: number; y: number }) => {
  if (!element) return;
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  let left: number;
  let top: number;

  if (anchor) {
    left = anchor.x;
    top = anchor.y;
  } else {
    const row = element.parentElement?.getBoundingClientRect();
    if (!row) return;
    left = row.right - 2;
    top = row.top - 5;
    if (left + width > window.innerWidth - MARGIN) left = row.left - width + 2;
  }

  element.style.left = `${Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))}px`;
  element.style.top = `${Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN))}px`;
};

interface MenuListProps {
  entries: MenuEntry[];
  autoFocus: boolean;
  onAction: (entry: ActionEntry) => void;
  onBack?: () => void;
}

function MenuList({ entries, autoFocus, onAction, onBack }: MenuListProps) {
  const [open, setOpen] = useState<{ index: number; byKeyboard: boolean } | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };

  useEffect(() => clearHoverTimer, []);

  const hoverSubmenu = (index: number) => {
    clearHoverTimer();
    if (open?.index === index) return;
    if (open === null) {
      setOpen({ index, byKeyboard: false });
      return;
    }
    hoverTimer.current = window.setTimeout(() => setOpen({ index, byKeyboard: false }), SUBMENU_DELAY_MS);
  };

  const leaveSubmenu = (index: number) => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(
      () => setOpen(current => current?.index === index ? null : current),
      SUBMENU_DELAY_MS
    );
  };

  const setListRef = (element: HTMLUListElement | null) => {
    listRef.current = element;
    if (element && autoFocus && !element.contains(document.activeElement)) focusables(element)[0]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = focusables(listRef.current);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + step + items.length) % items.length].focus();
    } else if (event.key === 'ArrowRight') {
      const index = Number(items[current].dataset.submenu);
      if (Number.isNaN(index)) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen({ index, byKeyboard: true });
    } else if (event.key === 'ArrowLeft' && onBack) {
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }
  };

  return (
    <ul className="context-menu-list" role="menu" ref={setListRef} onKeyDown={handleKeyDown}>
      {entries.map((entry, index) => {
        if (entry.kind === 'section') {
          return <li key={`section-${index}`} className="context-menu-section" role="presentation">{entry.label}</li>;
        }

        if (entry.kind === 'options') {
          return (
            <li key={`options-${index}`} className="context-menu-item has-options" role="presentation">
              <span className="context-menu-label">
                {entry.label}
                {entry.hint && <small>{entry.hint}</small>}
              </span>
              <span className="context-menu-options">
                {entry.options.map(option => (
                  <button
                    key={option.label}
                    type="button"
                    role="menuitem"
                    data-menuitem
                    className="context-menu-option"
                    disabled={option.disabled}
                    onClick={option.onSelect}
                  >
                    {option.label}
                  </button>
                ))}
              </span>
            </li>
          );
        }

        if (entry.kind === 'submenu') {
          const isOpen = open?.index === index;
          return (
            <li
              key={`submenu-${index}`}
              className="context-menu-item has-submenu"
              role="presentation"
              onMouseEnter={() => !entry.disabled && hoverSubmenu(index)}
              onMouseLeave={() => leaveSubmenu(index)}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                data-menuitem
                data-submenu={index}
                className="context-menu-button"
                disabled={entry.disabled}
                onClick={() => setOpen(isOpen ? null : { index, byKeyboard: false })}
              >
                <span className="context-menu-label">{entry.label}</span>
                {entry.hint && <small>{entry.hint}</small>}
                <span className="context-menu-arrow" aria-hidden="true">▸</span>
              </button>
              {isOpen && (
                <div className="context-menu context-submenu" ref={(element) => placeMenu(element)}>
                  <MenuList
                    entries={entry.entries}
                    autoFocus={open.byKeyboard}
                    onAction={onAction}
                    onBack={() => {
                      setOpen(null);
                      focusables(listRef.current).find(item => item.dataset.submenu === String(index))?.focus();
                    }}
                  />
                </div>
              )}
            </li>
          );
        }

        return (
          <li key={`action-${index}`} className="context-menu-item" role="presentation">
            <button
              type="button"
              role="menuitem"
              data-menuitem
              className={entry.danger ? 'context-menu-button is-danger' : 'context-menu-button'}
              disabled={entry.disabled}
              onClick={() => onAction(entry)}
            >
              <span className="context-menu-label">{entry.label}</span>
              {entry.hint && <small>{entry.hint}</small>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ContextMenu({ x, y, title, entries, onClose }: ContextMenuProps) {
  const [confirming, setConfirming] = useState<ActionEntry | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) onClose();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    // Desplazar la página cierra el menú; desplazar el propio menú no.
    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      onClose();
    };
    // La rueda sobre el menú no debe mover la página: si el panel no tiene scroll, se bloquea.
    const handleWheel = (event: WheelEvent) => {
      const panel = event.target instanceof Element ? event.target.closest<HTMLElement>('.context-menu') : null;
      if (panel && panel.scrollHeight <= panel.clientHeight) event.preventDefault();
    };
    const menu = menuRef.current;
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', handleScroll, true);
    menu?.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', handleScroll, true);
      menu?.removeEventListener('wheel', handleWheel);
    };
  }, [onClose]);

  const handleAction = (entry: ActionEntry) => {
    if (entry.confirm) setConfirming(entry);
    else entry.onSelect();
  };

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      ref={(element) => {
        menuRef.current = element;
        placeMenu(element, { x, y });
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="context-menu-title">{title}</p>
      {confirming ? (
        <div className="context-menu-confirm" role="alertdialog" aria-label={confirming.label}>
          <p>{confirming.confirm}</p>
          <div className="context-menu-confirm-actions">
            <button type="button" className="context-menu-option" onClick={() => setConfirming(null)}>Cancel</button>
            <button
              type="button"
              className="context-menu-option is-danger"
              ref={(element) => element?.focus()}
              onClick={confirming.onSelect}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : (
        <MenuList entries={entries} autoFocus onAction={handleAction} />
      )}
    </div>
  );
}
