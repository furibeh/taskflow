import { usePublicConfig } from '../../api/boards';
import { es } from '../../i18n/es';
import { CreateBoardForm } from './CreateBoardForm';
import './home.css';

/** Pantalla sin enlace: explica cómo entrar en un tablero y permite crear uno (US1, FR-107). */
export const HomePage = ({ onOpenBoard }: { readonly onOpenBoard: (accessCode: string) => void }) => {
  const config = usePublicConfig();

  return (
    <main className="home">
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
