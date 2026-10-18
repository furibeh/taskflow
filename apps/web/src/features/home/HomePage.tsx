import { useEffect } from 'react';
import { usePublicConfig } from '../../api/boards';
import { es } from '../../i18n/es';
import { useAnnounce } from '../../ui/LiveRegion';
import { CreateBoardForm } from './CreateBoardForm';
import './home.css';

/** Pantalla sin enlace: explica cómo entrar en un tablero y permite crear uno (US1, FR-107). */
interface HomePageProps {
  readonly onOpenBoard: (accessCode: string) => void;
  /** Aviso de lo que acaba de pasar (p. ej., "Tablero «X» borrado"). */
  readonly notice?: string | null;
}

export const HomePage = ({ onOpenBoard, notice = null }: HomePageProps) => {
  const config = usePublicConfig();
  const announce = useAnnounce();

  useEffect(() => {
    if (notice) announce(notice);
  }, [notice, announce]);

  return (
    <main className="home">
      {notice && <p className="home__notice">{notice}</p>}
      <h1 className="home__title">{es.home.title}</h1>
      <p>{es.home.intro}</p>
      {config.data?.boardCreationEnabled === true && (
        <section className="home__create" aria-labelledby="home-create-heading">
          <h2 id="home-create-heading">{es.createBoard.heading}</h2>
          <CreateBoardForm onOpenBoard={onOpenBoard} />
        </section>
      )}
      {config.data?.boardCreationEnabled === false && <p>{es.home.creationDisabled}</p>}
    </main>
  );
};
