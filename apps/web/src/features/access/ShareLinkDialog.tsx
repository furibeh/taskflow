import { useId, useState } from 'react';
import { useRegenerateLink } from '../../api/board';
import { ApiError } from '../../api/client';
import { getAccessCode, setAccessCode } from '../../app/access-code';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ErrorAlert } from '../../ui/ErrorAlert';
import { useAnnounce } from '../../ui/LiveRegion';
import './access.css';

const linkFor = (code: string | null): string =>
  code ? `${window.location.origin}${window.location.pathname}#k=${code}` : '';

/** Muestra y copia el enlace secreto; permite regenerarlo con confirmación (FR-028b). */
export const ShareLinkDialog = ({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) => {
  const linkId = useId();
  const [link, setLink] = useState(() => linkFor(getAccessCode()));
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const regenerate = useRegenerateLink();
  const announce = useAnnounce();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      announce(es.share.copied);
    } catch {
      setFailure(es.share.copyFailed);
    }
  };

  const confirm = () => {
    setFailure(null);
    regenerate.mutate(undefined, {
      onSuccess: ({ accessCode }) => {
        setAccessCode(accessCode);
        setLink(linkFor(accessCode));
        setConfirming(false);
        announce(es.share.regenerated);
      },
      onError: (error) => setFailure(errorMessage(error instanceof ApiError ? error.code : 'INTERNAL_ERROR')),
    });
  };

  return (
    <Dialog
      open={open}
      title={es.share.title}
      onClose={() => {
        setConfirming(false);
        setFailure(null);
        onClose();
      }}
    >
      <div className="share">
        <p className="share__intro">{es.share.intro}</p>
        <div className="field">
          <label htmlFor={linkId} className="field__label">
            {es.share.link}
          </label>
          <input
            id={linkId}
            className="field__input share__link"
            value={link}
            readOnly
            onFocus={(e) => e.target.select()}
          />
        </div>
        {failure && <ErrorAlert message={failure} />}
        <div className="task-detail__actions">
          <Button variant="primary" onClick={() => void copy()}>
            {es.share.copy}
          </Button>
          {!confirming && (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              {es.share.regenerate}
            </Button>
          )}
        </div>
        {confirming && (
          <div className="task-detail__confirm" role="group" aria-label={es.share.regenerate}>
            <p className="task-detail__warning">{es.share.regenerateWarning}</p>
            <div className="task-detail__actions">
              <Button variant="danger" onClick={confirm} disabled={regenerate.isPending}>
                {regenerate.isPending ? es.saving : es.share.confirmRegenerate}
              </Button>
              <Button onClick={() => setConfirming(false)} disabled={regenerate.isPending}>
                {es.share.cancel}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
