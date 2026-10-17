import { useEffect } from 'react';
import { es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { useAnnounce } from '../../ui/LiveRegion';

interface NoResultsProps {
  readonly search: string;
  readonly onClear: () => void;
}

/** Sin coincidencias (FR-026): mensaje según haya búsqueda o solo filtros, y anuncio accesible. */
export const NoResults = ({ search, onClear }: NoResultsProps) => {
  const announce = useAnnounce();
  const message = search ? es.filters.noResultsSearch(search) : es.filters.noResultsFilters;

  useEffect(() => announce(message), [announce, message]);

  return (
    <div className="no-results">
      <p className="no-results__message">{message}</p>
      <Button variant="primary" onClick={onClear}>
        {es.filters.clearSearchAndFilters}
      </Button>
    </div>
  );
};
