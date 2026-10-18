import { useId, useState } from 'react';
import { es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import './access.css';

export interface BoardMenuItem {
  readonly label: string;
  readonly onSelect: () => void;
}

/** Menú "Tablero" de la cabecera: botón que despliega las acciones sobre el tablero abierto. */
export const BoardMenu = ({ items }: { readonly items: readonly BoardMenuItem[] }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <div className="board-menu">
      <Button aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        {es.boardMenu.open}
      </Button>
      {open && (
        <ul id={listId} className="board-menu__list">
          {items.map((item) => (
            <li key={item.label}>
              <Button
                className="board-menu__item"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
