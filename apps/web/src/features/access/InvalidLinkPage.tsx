import { useState } from 'react';
import { usePublicConfig } from '../../api/boards';
import { es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { CreateBoardForm } from '../home/CreateBoardForm';

/** Página genérica sin ningún dato del tablero (FR-028c); ofrece crear uno nuevo (FR-107). */
export const InvalidLinkPage = ({ onOpenBoard }: { readonly onOpenBoard: (accessCode: string) => void }) => {
  const config = usePublicConfig();
  const [creating, setCreating] = useState(false);

  return (
    <main className="invalid-link">
      <h1>{es.invalidLink.title}</h1>
      <p>{es.invalidLink.body}</p>
      {config.data?.boardCreationEnabled === true &&
        (creating ? (
          <CreateBoardForm onOpenBoard={onOpenBoard} />
        ) : (
          <Button variant="primary" onClick={() => setCreating(true)}>
            {es.home.createNew}
          </Button>
        ))}
    </main>
  );
};
